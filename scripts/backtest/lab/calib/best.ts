import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FULL_FIT, QUICK_FIT, TRAIN } from '../harness.ts';
import { allianceMargin, hiLo } from './alliance.ts';
import { DIR, load } from './data.ts';
import { Ctx, logistic, logit, nelderMead, printRows, sigmoid, type Row } from './lib.ts';

const dump = await load(process.argv[2] ?? 'robot');
const ctx = new Ctx(dump);
const n = ctx.rec.n;
const y = ctx.rec.outcome;
const rows: Row[] = [ctx.row('shipped', ctx.base)];
const fitted: Record<string, number[]> = {};
const oofs = new Map<string, Float64Array>();

function cached(k: number) {
	const robot = k > 0;
	const h = new Float64Array(n * 4);
	const half = new Float64Array(n);
	const lvl = new Float64Array(n);
	const vf = new Float64Array(n);
	for (let r = 0; r < n; r++) {
		h.set(hiLo(ctx, r, robot), r * 4);
		half[r] = ctx.rec.mean[r] / 2 || 1;
		const red = ctx.pred(k, r, 0);
		const blue = ctx.pred(k, r, 1);
		lvl[r] = ctx.rec.mean[r] > 0 ? Math.min(Math.max((red + blue) / (2 * ctx.rec.mean[r]), 0.25), 4) : 1;
		vf[r] = ctx.pred(k, r, 2);
	}
	return { h, half, lvl, vf };
}

function family(k: number, floor: boolean) {
	const c = cached(k);
	const x0 = floor ? [-0.99, -1.36, 0.54, 0.08, 0.26, -1.84] : [-0.9, -1.4, 0.37, 0.15];
	const p = (x: number[], r: number) => {
		const o = r * 4;
		const m = floor
			? allianceMargin([c.h[o], c.h[o + 2]], [c.h[o + 1], c.h[o + 3]], c.half[r], {
					carry: x[3],
					floor: x[4],
					width: Math.exp(x[5])
				})
			: c.h[o] + c.h[o + 1] - c.h[o + 2] - c.h[o + 3] + x[3] * (c.h[o] - c.h[o + 1] - (c.h[o + 2] - c.h[o + 3]));
		const s =
			Math.exp(x[0]) * ctx.rec.sd[r] * Math.sqrt(c.vf[r] + Math.exp(x[1]) * ctx.rec.unc[r]) * c.lvl[r] ** x[2];
		return sigmoid(m / s);
	};
	return { x0, p };
}

function parametric(label: string, k: number, floor: boolean) {
	const { x0, p } = family(k, floor);
	const fit = (train: Int32Array) => {
		const loss = (x: number[]) => {
			let s = 0;
			for (let i = 0; i < train.length; i++) {
				const r = train[i];
				s += (p(x, r) - y[r]) ** 2;
			}
			return s / train.length;
		};
		let best = nelderMead(loss, x0, 0.15, 300);
		best = nelderMead(loss, best.x, 0.04, 300);
		return best.x;
	};
	const res = ctx.cv((train) => {
		const x = fit(train);
		return (r) => p(x, r);
	});
	const x = fit(ctx.train);
	fitted[label] = x;
	oofs.set(label, res.oof);
	const by = TRAIN.map((s) => ctx.brier(res.oof, ctx.trainBySeason.get(s)!).toFixed(4));
	console.log(label, x.map((a) => a.toFixed(3)).join(' '), '| oof by season', by.join(' '));
	const row = ctx.row(label, res.p, res.cv);
	rows.push(row);
	printRows([row]);
}

function grid(label: string, k: number) {
	const { map, p } = ctx.fitMapped(k, FULL_FIT);
	console.log(label, JSON.stringify(map));
	const res = ctx.cv((train) => {
		const q = ctx.mapped(k, fitMap(k, train));
		return (r) => q[r];
	});
	oofs.set(label, res.oof);
	const row = ctx.row(label, p, res.cv);
	rows.push(row);
	printRows([row]);
}

function fitMap(k: number, train: Int32Array) {
	const save = ctx.train;
	ctx.train = train;
	const { map } = ctx.fitMapped(k, FULL_FIT);
	ctx.train = save;
	return map;
}

function stack(label: string, X: Float64Array[]) {
	const res = ctx.cv((train) => {
		const w = logistic(X, y, train, 1e-4);
		return (r) => {
			let z = 0;
			for (let a = 0; a < X.length; a++) z += w[a] * X[a][r];
			return sigmoid(z);
		};
	});
	const w = logistic(X, y, ctx.train, 1e-4);
	fitted[label] = Array.from(w);
	oofs.set(label, res.oof);
	console.log(label, Array.from(w, (v) => v.toFixed(3)).join(' '));
	const row = ctx.row(label, res.p, res.cv);
	rows.push(row);
	printRows([row]);
}

const hasRobot = ctx.rec.models.includes('robot-het');
const bases: [string, number][] = [['shipped', 0]];
if (hasRobot) bases.push(['robot', ctx.model('robot-het')]);
for (const [name, k] of bases) {
	if (k > 0) grid(`${name} grid refit`, k);
	parametric(`${name} carry`, k, false);
	parametric(`${name} carry+floor`, k, true);
}
const L = (label: string) => oofs.get(label)!.map(logit);
const loose = ctx.fitMapped(ctx.model('opr-loose'), QUICK_FIT).p.map(logit);
const epa = ctx.fitMapped(ctx.model('epa-reset'), QUICK_FIT).p.map(logit);
const col = (f: (r: number) => number) => {
	const a = new Float64Array(n);
	for (let r = 0; r < n; r++) a[r] = f(r);
	return a;
};
const g = [
	col((r) => ctx.rec.playoff[r]),
	col((r) => ctx.f(r, 'firstEvent') / 4),
	col((r) => Math.log1p(ctx.f(r, 'minPlayed'))),
	col((r) => (ctx.f(r, 'redUnplayed') + ctx.f(r, 'blueUnplayed')) / 4)
];
const inter = (zs: Float64Array[]) => zs.flatMap((z) => g.map((v) => z.map((a, r) => a * v[r])));
for (const [name] of bases) {
	const z = L(`${name} carry+floor`);
	stack(`${name} cf + opr-loose`, [z, loose]);
	stack(`${name} cf + epa-reset`, [z, epa]);
	stack(`${name} cf + loose + epa`, [z, loose, epa]);
	stack(`${name} cf + loose + epa x ctx`, [z, loose, epa, ...inter([z, loose, epa])]);
}
if (hasRobot) {
	const zr = L('robot carry+floor');
	const zs = L('shipped carry+floor');
	stack('robot cf + shipped cf', [zr, zs]);
	stack('robot cf + shipped cf + loose + epa', [zr, zs, loose, epa]);
	stack('robot cf + shipped cf + loose + epa x ctx', [zr, zs, loose, epa, ...inter([zr, zs, loose, epa])]);
}

console.log();
printRows(rows);
const out = join(import.meta.dirname, 'results');
await mkdir(out, { recursive: true });
await writeFile(join(out, `best-${process.argv[2] ?? 'robot'}.json`), `${JSON.stringify({ rows, fitted }, null, '\t')}\n`);
const keep = new Float64Array(n * oofs.size);
[...oofs.values()].forEach((a, i) => keep.set(a, i * n));
await writeFile(join(DIR, process.argv[2] ?? 'robot', 'oof.bin'), new Uint8Array(keep.buffer));
await writeFile(join(DIR, process.argv[2] ?? 'robot', 'oof.json'), JSON.stringify([...oofs.keys()]));
