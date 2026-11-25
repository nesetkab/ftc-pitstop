import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { QUICK_FIT, TRAIN } from '../harness.ts';
import { columns } from './cols.ts';
import { load } from './data.ts';
import { Ctx, logistic, logit, nelderMead, printRows, sigmoid, type Row } from './lib.ts';

const dump = await load(process.argv[2] ?? 'main');
const ctx = new Ctx(dump);
const c = columns(ctx);
const n = ctx.rec.n;
const y = ctx.rec.outcome;
const half = (r: number) => ctx.rec.mean[r] / 2 || 1;
const KEYS = ['redHi', 'redLo', 'blueHi', 'blueLo'] as const;
const relv = KEYS.map((k) => {
	const a = new Float64Array(n);
	for (let r = 0; r < n; r++) a[r] = ctx.f(r, k) / half(r);
	return a;
});
const soft = (v: number, floor: number, w: number) => {
	const t = (v - floor) / w;
	return floor + w * (t > 30 ? t : Math.log1p(Math.exp(t)));
};

type Opts = {
	pen?: boolean;
	noise?: boolean;
	cons?: boolean;
	kind?: boolean;
	power?: boolean;
	po?: boolean;
};

function family(o: Opts) {
	const x0 = [-0.99, -1.36, 0.54, 0.08, 0.26, -1.84];
	const idx: Record<string, number> = {};
	const add = (k: string, v: number[]) => {
		idx[k] = x0.length;
		x0.push(...v);
	};
	if (o.pen) add('pen', [-0.7, 1.5]);
	if (o.noise) add('noise', [0.1, 2.8]);
	if (o.cons) add('cons', [0.04]);
	if (o.kind) add('kind', [-0.1, 0.06]);
	if (o.power) add('power', [1.2]);
	if (o.po) add('po', [0]);
	const p = (x: number[], r: number) => {
		const w = Math.exp(x[5]);
		const v = relv.map((a) => soft(a[r], x[4], w));
		let m: number;
		if (o.power) {
			const e = x[idx.power];
			const pm = (a: number, b: number) => 2 * ((a ** e + b ** e) / 2) ** (1 / e);
			m =
				pm(Math.max(v[0], 1e-3), Math.max(v[1], 1e-3)) -
				pm(Math.max(v[2], 1e-3), Math.max(v[3], 1e-3));
		} else m = v[0] + v[1] - v[2] - v[3];
		m += x[3] * (v[0] - v[1] - (v[2] - v[3]));
		m *= half(r);
		let extra = 0;
		if (o.pen) {
			const k = Math.exp(x[idx.pen + 1]);
			extra += (Math.exp(x[idx.pen]) * (c.evPenVar[r] + k * c.sePenVar[r])) / (c.evPenN[r] + k);
		}
		let s =
			Math.exp(x[0]) *
			c.sd[r] *
			Math.sqrt(c.vf[r] + Math.exp(x[1]) * c.unc[r] + extra) *
			c.lvl[r] ** x[2];
		if (o.noise) {
			const k = Math.exp(x[idx.noise + 1]);
			const ratio = (c.evResVar[r] + k * c.seResVar[r]) / (c.evResN[r] + k) / c.seResVar[r];
			s *= ratio ** x[idx.noise];
		}
		if (o.cons) s *= (c.cons[r] / c.seResVar[r]) ** x[idx.cons];
		if (o.kind) s *= Math.exp(x[idx.kind] * c.off[r] + x[idx.kind + 1] * c.champ[r]);
		if (o.po) s *= Math.exp(x[idx.po] * c.po[r]);
		return sigmoid(m / s);
	};
	return { x0, p };
}

function fitter(x0: number[], p: (x: number[], r: number) => number) {
	return (train: Int32Array) => {
		const loss = (x: number[]) => {
			let s = 0;
			for (let i = 0; i < train.length; i++) {
				const r = train[i];
				s += (p(x, r) - y[r]) ** 2;
			}
			return s / train.length;
		};
		let best = nelderMead(loss, x0, 0.15, 400);
		best = nelderMead(loss, best.x, 0.04, 400);
		return best.x;
	};
}

const rows: Row[] = [ctx.row('shipped', ctx.base)];
const keep = new Map<string, Float64Array>();
const fittedAll: Record<string, number[]> = {};
const VARIANTS: [string, Opts][] = [
	['carry+floor', {}],
	['carry+floor +pen', { pen: true }],
	['carry+floor +pen+noise', { pen: true, noise: true }],
	['carry+floor +pen+noise+cons', { pen: true, noise: true, cons: true }],
	['carry+floor +pen+noise+kind', { pen: true, noise: true, kind: true }],
	['power+carry+floor +pen+noise', { pen: true, noise: true, power: true }],
	['carry+floor +pen+noise+po', { pen: true, noise: true, po: true }]
];
for (const [name, o] of VARIANTS) {
	const { x0, p } = family(o);
	const fit = fitter(x0, p);
	const res = ctx.cv((train) => {
		const x = fit(train);
		return (r) => p(x, r);
	});
	const x = fit(ctx.train);
	fittedAll[name] = x;
	keep.set(name, res.oof);
	const by = TRAIN.map((s) => ctx.brier(res.oof, ctx.trainBySeason.get(s)!).toFixed(4));
	console.log(name, x.map((a) => a.toFixed(3)).join(' '), '| oof by season', by.join(' '));
	const row = ctx.row(name, res.p, res.cv);
	rows.push(row);
	printRows([row]);
}

const best = keep.get('carry+floor +pen+noise')!;
const others = ['opr-loose', 'epa-reset', 'opr-huber', 'opr-total', 'opr-ridge-mean', 'opr-event'];
const lg: Float64Array[] = [best.map(logit)];
for (const name of others) {
	const k = ctx.model(name);
	const { p } = ctx.fitMapped(k, QUICK_FIT);
	lg.push(p.map(logit));
}
const po = Float64Array.from(c.po);
const stackRows = (label: string, X: Float64Array[]) => {
	const res = ctx.cv((train) => {
		const w = logistic(X, y, train, 1e-4);
		return (r) => {
			let z = 0;
			for (let a = 0; a < X.length; a++) z += w[a] * X[a][r];
			return sigmoid(z);
		};
	});
	const w = logistic(X, y, ctx.train, 1e-4);
	console.log(label, Array.from(w, (v) => v.toFixed(3)).join(' '));
	const row = ctx.row(label, res.p, res.cv);
	rows.push(row);
	printRows([row]);
};
stackRows('stack v2 + opr-loose', [lg[0], lg[1]]);
stackRows('stack v2 + epa-reset', [lg[0], lg[2]]);
stackRows('stack v2 + all raters', lg);
stackRows('stack v2 + all raters x po', [...lg, ...lg.map((z) => z.map((v, r) => v * po[r]))]);

console.log();
printRows(rows);
const out = join(import.meta.dirname, 'results');
await mkdir(out, { recursive: true });
await writeFile(
	join(out, 'final.json'),
	`${JSON.stringify({ rows, fitted: fittedAll }, null, '\t')}\n`
);
