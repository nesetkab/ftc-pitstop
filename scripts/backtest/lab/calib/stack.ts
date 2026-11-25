import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { QUICK_FIT } from '../harness.ts';
import { columns } from './cols.ts';
import { load } from './data.ts';
import { Ctx, logistic, logit, nelderMead, printRows, sigmoid, type Row } from './lib.ts';

const dump = await load(process.argv[2] ?? 'main');
const ctx = new Ctx(dump);
const cols = columns(ctx);
const n = ctx.rec.n;
const y = ctx.rec.outcome;
const rows: Row[] = [ctx.row('shipped', ctx.base)];
const report = (row: Row) => {
	rows.push(row);
	printRows([row]);
};

const names = ctx.rec.models;
const probs = new Map<string, Float64Array>();
probs.set('shipped', ctx.base);
for (let k = 1; k < names.length; k++) {
	const { map, p } = ctx.fitMapped(k, QUICK_FIT);
	probs.set(names[k], p);
	console.log(names[k], JSON.stringify(map));
	report(ctx.row(`single ${names[k]}`, p));
}
const lg = new Map([...probs].map(([k, p]) => [k, p.map(logit)]));
const ones = new Float64Array(n).fill(1);

function stack(label: string, X: Float64Array[], l2 = 1e-4) {
	const fp = (train: Int32Array) => {
		const w = logistic(X, y, train, l2);
		return (r: number) => {
			let z = 0;
			for (let a = 0; a < X.length; a++) z += w[a] * X[a][r];
			return sigmoid(z);
		};
	};
	const { cv, p } = ctx.cv(fp);
	const w = logistic(X, y, ctx.train, l2);
	console.log(label, Array.from(w, (v) => v.toFixed(3)).join(' '));
	report(ctx.row(label, p, cv));
	return p;
}

function avg(label: string, keys: string[]) {
	const fp = (train: Int32Array) => {
		const loss = (x: number[]) => {
			const w = softmax(x);
			let s = 0;
			for (let i = 0; i < train.length; i++) {
				const r = train[i];
				let p = 0;
				keys.forEach((k, j) => (p += w[j] * probs.get(k)![r]));
				s += (p - y[r]) ** 2;
			}
			return s / train.length;
		};
		const w = softmax(nelderMead(loss, keys.map(() => 0), 0.5, 400).x);
		console.log(label, w.map((v) => v.toFixed(3)).join(' '));
		return (r: number) => keys.reduce((p, k, j) => p + w[j] * probs.get(k)![r], 0);
	};
	const { cv, p } = ctx.cv(fp);
	report(ctx.row(label, p, cv));
}

const softmax = (x: number[]) => {
	const m = Math.max(...x);
	const e = x.map((v) => Math.exp(v - m));
	const s = e.reduce((a, b) => a + b, 0);
	return e.map((v) => v / s);
};

const L = (k: string) => lg.get(k)!;
avg('prob avg shipped+epa-reset', ['shipped', 'epa-reset']);
avg('prob avg all', [...probs.keys()]);
stack('logit stack shipped+epa-reset', [L('shipped'), L('epa-reset')]);
stack('logit stack all', [...lg.values()]);
stack('platt shipped', [L('shipped'), ones]);

const col = (f: (r: number) => number) => {
	const a = new Float64Array(n);
	for (let r = 0; r < n; r++) a[r] = f(r);
	return a;
};
const g = {
	po: col((r) => cols.po[r]),
	unc: col((r) => cols.unc[r]),
	lvl: col((r) => Math.log(cols.lvl[r])),
	early: col((r) => ctx.rec.early[r]),
	off: col((r) => cols.off[r]),
	champ: col((r) => cols.champ[r]),
	played: col((r) => Math.log1p(cols.minPlayed[r])),
	newT: col((r) => cols.newTeams[r]),
	first: col((r) => cols.first[r]),
	week: col((r) => Math.min(cols.week[r], 30) / 10),
	pen: col((r) => (cols.evPenVar[r] + 10 * cols.sePenVar[r]) / (cols.evPenN[r] + 10)),
	cons: col((r) => Math.log(cols.cons[r] / cols.seResVar[r]))
};
const times = (a: Float64Array, b: Float64Array) => a.map((v, r) => v * b[r]);
const zS = L('shipped');
const zE = L('epa-reset');
const inter = (z: Float64Array, keys: (keyof typeof g)[]) => keys.map((k) => times(z, g[k]));
const gk = Object.keys(g) as (keyof typeof g)[];
stack('shipped x context', [zS, ...inter(zS, gk)]);
stack('shipped+epa x context', [zS, zE, ...inter(zS, gk), ...inter(zE, gk)]);
const carry = col((r) => cols.carry[r]);
stack('shipped + carry', [zS, carry]);
const scoreM = col((r) => (ctx.pred(0, r, 3) - ctx.pred(0, r, 4)) / cols.sd[r]);
stack('shipped + score margin', [zS, scoreM]);
stack('all logits x context', [...lg.values(), ...inter(zS, gk), ...inter(zE, gk), carry]);
stack('all logits x context + po split', [
	...lg.values(),
	...[...lg.values()].map((z) => times(z, g.po)),
	...inter(zS, gk),
	carry
]);

console.log();
printRows(rows);
const out = join(import.meta.dirname, 'results');
await mkdir(out, { recursive: true });
await writeFile(join(out, 'stack.json'), `${JSON.stringify(rows, null, '\t')}\n`);
