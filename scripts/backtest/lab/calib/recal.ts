import { load } from './data.ts';
import { Ctx, logistic, logit, printRows, sigmoid, type Row } from './lib.ts';

const dump = await load(process.argv[2] ?? 'main');
const ctx = new Ctx(dump);
const n = ctx.rec.n;
const y = ctx.rec.outcome;
const base = ctx.base;
const rows: Row[] = [ctx.row('shipped', base)];

function symmetric(p: Float64Array, r: number, f: (q: number) => number): number {
	return p[r] >= 0.5 ? f(p[r]) : 1 - f(1 - p[r]);
}

function isotonic(train: Int32Array): (r: number) => number {
	const pts = Array.from(train, (r) =>
		base[r] >= 0.5 ? { x: base[r], y: y[r] } : { x: 1 - base[r], y: 1 - y[r] }
	).sort((a, b) => a.x - b.x);
	const blocks: { x: number; s: number; w: number }[] = [];
	for (const p of pts) {
		blocks.push({ x: p.x, s: p.y, w: 1 });
		while (blocks.length > 1) {
			const a = blocks[blocks.length - 2];
			const b = blocks[blocks.length - 1];
			if (a.s / a.w <= b.s / b.w) break;
			a.s += b.s;
			a.w += b.w;
			a.x = b.x;
			blocks.pop();
		}
	}
	const xs = blocks.map((b) => b.x);
	const vs = blocks.map((b) => b.s / b.w);
	const at = (q: number) => {
		let lo = 0;
		let hi = xs.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (xs[mid] < q) lo = mid + 1;
			else hi = mid;
		}
		return Math.max(vs[lo], 0.5);
	};
	return (r) => symmetric(base, r, at);
}

function beta(train: Int32Array): (r: number) => number {
	const a1 = base.map((p) => Math.log(Math.max(p, 1e-6)));
	const a2 = base.map((p) => -Math.log(Math.max(1 - p, 1e-6)));
	const one = new Float64Array(n).fill(1);
	const w = logistic([a1, a2, one], y, train, 1e-6);
	console.log('beta', Array.from(w, (v) => v.toFixed(4)).join(' '));
	return (r) => sigmoid(w[0] * a1[r] + w[1] * a2[r] + w[2]);
}

function platt(train: Int32Array): (r: number) => number {
	const z = base.map(logit);
	const one = new Float64Array(n).fill(1);
	const w = logistic([z, one], y, train, 1e-6);
	console.log('platt', Array.from(w, (v) => v.toFixed(4)).join(' '));
	return (r) => sigmoid(w[0] * z[r] + w[1]);
}

for (const [name, fp] of [
	['platt', platt],
	['beta calibration', beta],
	['isotonic symmetric', isotonic]
] as const) {
	const { cv, p } = ctx.cv(fp);
	rows.push(ctx.row(name, p, cv));
}
printRows(rows);
