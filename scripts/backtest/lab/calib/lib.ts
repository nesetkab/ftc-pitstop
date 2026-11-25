import { normalCdf } from '../../../../src/lib/model/stats.ts';
import { STRIDE, type Records } from '../../engine.ts';
import { fitMapping, probAt, rowsOf, type FitOptions, type Mapping } from '../../metrics.ts';
import { FULL_FIT, TEST, TRAIN } from '../harness.ts';
import type { Dump } from './data.ts';
import { F } from './probe.ts';

export type Row = {
	name: string;
	train: number;
	cv?: number;
	test: number;
	acc: number;
	qual: number;
	qualAcc: number;
	po: number;
	poAcc: number;
	ll: number;
	gap: number;
	se: number;
};

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
export const logit = (p: number) => {
	const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
	return Math.log(q / (1 - q));
};

export class Ctx {
	d: Dump;
	rec: Records;
	M: number;
	train: Int32Array;
	test: Int32Array;
	trainBySeason: Map<number, Int32Array>;
	all: Int32Array;
	base: Float64Array;
	baseMap: Mapping;

	constructor(d: Dump) {
		this.d = d;
		this.rec = d.rec;
		this.M = d.rec.models.length;
		const tr = new Set(TRAIN);
		this.train = rowsOf(d.rec, (r) => tr.has(d.rec.season[r]));
		this.test = rowsOf(d.rec, (r) => d.rec.season[r] === TEST);
		this.all = rowsOf(d.rec, () => true);
		this.trainBySeason = new Map(
			TRAIN.map((s) => [s, rowsOf(d.rec, (r) => d.rec.season[r] === s)])
		);
		this.baseMap = fitMapping(d.rec, 0, this.train, FULL_FIT);
		this.base = this.mapped(0, this.baseMap);
	}

	model(name: string): number {
		const k = this.rec.models.indexOf(name);
		if (k < 0) throw new Error(name);
		return k;
	}

	pred(k: number, r: number, j: number): number {
		return this.rec.pred[(r * this.M + k) * STRIDE + j];
	}

	margin(k: number, r: number): number {
		return this.pred(k, r, 0) - this.pred(k, r, 1);
	}

	f(r: number, name: keyof typeof F): number {
		return this.d.feat[r * this.d.nf + F[name]];
	}

	mapped(k: number, map: Mapping): Float64Array {
		const p = new Float64Array(this.rec.n);
		for (let r = 0; r < this.rec.n; r++) p[r] = probAt(this.rec, k, r, map);
		return p;
	}

	fitMapped(k: number, fit: FitOptions = FULL_FIT): { map: Mapping; p: Float64Array } {
		const map = fitMapping(this.rec, k, this.train, fit);
		return { map, p: this.mapped(k, map) };
	}

	trainExcept(season: number): Int32Array {
		const parts = TRAIN.filter((s) => s !== season).map((s) => this.trainBySeason.get(s)!);
		const out = new Int32Array(parts.reduce((n, a) => n + a.length, 0));
		let o = 0;
		for (const a of parts) {
			out.set(a, o);
			o += a.length;
		}
		return out;
	}

	brier(p: Float64Array, rows: Int32Array): number {
		let s = 0;
		for (let i = 0; i < rows.length; i++) s += (p[rows[i]] - this.rec.outcome[rows[i]]) ** 2;
		return s / rows.length;
	}

	cv(fitPredict: (trainRows: Int32Array) => (r: number) => number): {
		cv: number;
		p: Float64Array;
	} {
		const p = new Float64Array(this.rec.n);
		let total = 0;
		for (const s of TRAIN) {
			const g = fitPredict(this.trainExcept(s));
			const rows = this.trainBySeason.get(s)!;
			for (let i = 0; i < rows.length; i++) {
				const r = rows[i];
				total += (g(r) - this.rec.outcome[r]) ** 2;
			}
		}
		const g = fitPredict(this.train);
		for (let r = 0; r < this.rec.n; r++) p[r] = g(r);
		return { cv: total / this.train.length, p };
	}

	row(name: string, p: Float64Array, cv?: number): Row {
		const rec = this.rec;
		const stat = (rows: Int32Array) => {
			let b = 0;
			let ll = 0;
			let dec = 0;
			let cor = 0;
			for (let i = 0; i < rows.length; i++) {
				const r = rows[i];
				const y = rec.outcome[r];
				const q = Math.min(Math.max(p[r], 1e-6), 1 - 1e-6);
				b += (p[r] - y) ** 2;
				ll -= y * Math.log(q) + (1 - y) * Math.log(1 - q);
				if (y !== 0.5) {
					dec++;
					cor += p[r] === 0.5 ? 0.5 : p[r] > 0.5 === (y === 1) ? 1 : 0;
				}
			}
			return { b: b / rows.length, ll: ll / rows.length, acc: cor / dec };
		};
		const t = stat(this.test);
		const q = stat(this.test.filter((r) => rec.playoff[r] === 0));
		const po = stat(this.test.filter((r) => rec.playoff[r] === 1));
		let n = 0;
		let sum = 0;
		let sq = 0;
		for (const r of this.test) {
			const y = rec.outcome[r];
			const d = (p[r] - y) ** 2 - (this.base[r] - y) ** 2;
			n++;
			sum += d;
			sq += d * d;
		}
		const mean = sum / n;
		return {
			name,
			train: this.brier(p, this.train),
			cv,
			test: t.b,
			acc: t.acc,
			qual: q.b,
			qualAcc: q.acc,
			po: po.b,
			poAcc: po.acc,
			ll: t.ll,
			gap: mean,
			se: Math.sqrt(Math.max(sq / n - mean * mean, 0) / n)
		};
	}
}

export function printRows(rows: Row[]): void {
	const b = (x: number | undefined) => (x === undefined ? '' : x.toFixed(4)).padStart(7);
	const pct = (x: number) => (x * 100).toFixed(1).padStart(6);
	console.log(
		'variant'.padEnd(34),
		'train'.padStart(7),
		'cv'.padStart(7),
		'2026'.padStart(7),
		'acc'.padStart(6),
		'qual'.padStart(7),
		'qAcc'.padStart(6),
		'po'.padStart(7),
		'poAcc'.padStart(6),
		'll'.padStart(7),
		'gap'.padStart(9),
		'se'.padStart(8),
		'z'.padStart(6)
	);
	for (const r of rows) {
		console.log(
			r.name.slice(0, 34).padEnd(34),
			b(r.train),
			b(r.cv),
			b(r.test),
			pct(r.acc),
			b(r.qual),
			pct(r.qualAcc),
			b(r.po),
			pct(r.poAcc),
			b(r.ll),
			r.gap.toFixed(5).padStart(9),
			r.se.toFixed(5).padStart(8),
			(r.se > 0 ? r.gap / r.se : 0).toFixed(1).padStart(6)
		);
	}
}

export function nelderMead(
	f: (x: number[]) => number,
	x0: number[],
	step = 0.1,
	iters = 400
): { x: number[]; fx: number } {
	const n = x0.length;
	let simplex = [x0.slice()];
	for (let i = 0; i < n; i++) {
		const x = x0.slice();
		x[i] += Math.abs(x[i]) > 1e-9 ? step * Math.abs(x[i]) + step * 0.1 : step;
		simplex.push(x);
	}
	let vals = simplex.map(f);
	for (let it = 0; it < iters; it++) {
		const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
		simplex = order.map((i) => simplex[i]);
		vals = order.map((i) => vals[i]);
		if (Math.abs(vals[n] - vals[0]) < 1e-9) break;
		const c = new Array(n).fill(0);
		for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
		const at = (t: number) => c.map((cj, j) => cj + t * (simplex[n][j] - cj));
		const xr = at(-1);
		const fr = f(xr);
		if (fr < vals[0]) {
			const xe = at(-2);
			const fe = f(xe);
			if (fe < fr) {
				simplex[n] = xe;
				vals[n] = fe;
			} else {
				simplex[n] = xr;
				vals[n] = fr;
			}
		} else if (fr < vals[n - 1]) {
			simplex[n] = xr;
			vals[n] = fr;
		} else {
			const xc = fr < vals[n] ? at(-0.5) : at(0.5);
			const fc = f(xc);
			if (fc < Math.min(fr, vals[n])) {
				simplex[n] = xc;
				vals[n] = fc;
			} else {
				for (let i = 1; i <= n; i++) {
					simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j]));
					vals[i] = f(simplex[i]);
				}
			}
		}
	}
	let best = 0;
	for (let i = 1; i <= n; i++) if (vals[i] < vals[best]) best = i;
	return { x: simplex[best], fx: vals[best] };
}

export function logistic(
	X: Float64Array[],
	y: Float64Array,
	rows: Int32Array,
	l2 = 1e-3,
	iters = 25
): Float64Array {
	const k = X.length;
	const w = new Float64Array(k);
	for (let it = 0; it < iters; it++) {
		const g = new Float64Array(k);
		const H = new Float64Array(k * k);
		for (let i = 0; i < rows.length; i++) {
			const r = rows[i];
			let z = 0;
			for (let a = 0; a < k; a++) z += w[a] * X[a][r];
			const p = sigmoid(z);
			const e = p - y[r];
			const v = Math.max(p * (1 - p), 1e-9);
			for (let a = 0; a < k; a++) {
				const xa = X[a][r];
				g[a] += e * xa;
				for (let b = a; b < k; b++) H[a * k + b] += v * xa * X[b][r];
			}
		}
		const n = rows.length;
		for (let a = 0; a < k; a++) {
			g[a] = g[a] / n + l2 * w[a];
			for (let b = a; b < k; b++) {
				H[a * k + b] = H[a * k + b] / n + (a === b ? l2 : 0);
				H[b * k + a] = H[a * k + b];
			}
		}
		const step = solve(H, g, k);
		let max = 0;
		for (let a = 0; a < k; a++) {
			w[a] -= step[a];
			max = Math.max(max, Math.abs(step[a]));
		}
		if (max < 1e-8) break;
	}
	return w;
}

function solve(A: Float64Array, b: Float64Array, n: number): Float64Array {
	const M = Float64Array.from(A);
	const x = Float64Array.from(b);
	for (let i = 0; i < n; i++) {
		let piv = i;
		for (let j = i + 1; j < n; j++) if (Math.abs(M[j * n + i]) > Math.abs(M[piv * n + i])) piv = j;
		if (piv !== i) {
			for (let c = 0; c < n; c++) [M[i * n + c], M[piv * n + c]] = [M[piv * n + c], M[i * n + c]];
			[x[i], x[piv]] = [x[piv], x[i]];
		}
		const d = M[i * n + i] || 1e-12;
		for (let j = i + 1; j < n; j++) {
			const f = M[j * n + i] / d;
			if (f === 0) continue;
			for (let c = i; c < n; c++) M[j * n + c] -= f * M[i * n + c];
			x[j] -= f * x[i];
		}
	}
	for (let i = n - 1; i >= 0; i--) {
		let s = x[i];
		for (let c = i + 1; c < n; c++) s -= M[i * n + c] * x[c];
		x[i] = s / (M[i * n + i] || 1e-12);
	}
	return x;
}

export function tCdf(t: number, nu: number): number {
	const x = nu / (nu + t * t);
	const tail = 0.5 * betaInc(x, nu / 2, 0.5);
	return t > 0 ? 1 - tail : tail;
}

function betaInc(x: number, a: number, b: number): number {
	if (x <= 0) return 0;
	if (x >= 1) return 1;
	const lbeta = lgamma(a + b) - lgamma(a) - lgamma(b);
	const front = Math.exp(lbeta + a * Math.log(x) + b * Math.log(1 - x));
	if (x < (a + 1) / (a + b + 2)) return (front * betacf(x, a, b)) / a;
	return 1 - (front * betacf(1 - x, b, a)) / b;
}

function betacf(x: number, a: number, b: number): number {
	const tiny = 1e-30;
	let c = 1;
	let d = 1 - ((a + b) * x) / (a + 1);
	if (Math.abs(d) < tiny) d = tiny;
	d = 1 / d;
	let h = d;
	for (let m = 1; m <= 200; m++) {
		const m2 = 2 * m;
		let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
		d = 1 + aa * d;
		if (Math.abs(d) < tiny) d = tiny;
		c = 1 + aa / c;
		if (Math.abs(c) < tiny) c = tiny;
		d = 1 / d;
		h *= d * c;
		aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
		d = 1 + aa * d;
		if (Math.abs(d) < tiny) d = tiny;
		c = 1 + aa / c;
		if (Math.abs(c) < tiny) c = tiny;
		d = 1 / d;
		const del = d * c;
		h *= del;
		if (Math.abs(del - 1) < 1e-10) break;
	}
	return h;
}

function lgamma(z: number): number {
	const g = 7;
	const c = [
		0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
		-176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
		1.5056327351493116e-7
	];
	if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
	z -= 1;
	let x = c[0];
	for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
	const t = z + g + 0.5;
	return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

export { normalCdf };
