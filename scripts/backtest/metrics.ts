import { normalCdf } from '../../src/lib/model/stats.ts';
import { STRIDE, type Records } from './engine.ts';

export type Link = 'probit' | 'logit';

export type Mapping = { link: Link; kappa: number; eta: number; gamma: number };

export type Scores = { n: number; brier: number; logloss: number; accuracy: number; mae: number };

export type Filter = (r: number) => boolean;

export function winProb(margin: number, scale: number, link: Link): number {
	const z = margin / scale;
	return link === 'probit' ? normalCdf(z) : 1 / (1 + Math.exp(-z));
}

export function probAt(rec: Records, model: number, r: number, map: Mapping): number {
	const M = rec.models.length;
	const o = (r * M + model) * STRIDE;
	const red = rec.pred[o];
	const blue = rec.pred[o + 1];
	let scale = map.kappa * rec.sd[r] * Math.sqrt(rec.pred[o + 2] + map.eta * rec.unc[r]);
	if (map.gamma !== 0 && rec.mean[r] > 0) {
		const level = Math.min(Math.max((red + blue) / (2 * rec.mean[r]), 0.25), 4);
		scale *= level ** map.gamma;
	}
	return winProb(red - blue, scale, map.link);
}

export function score(rec: Records, model: number, map: Mapping, filter: Filter): Scores {
	const M = rec.models.length;
	let n = 0;
	let brier = 0;
	let logloss = 0;
	let decided = 0;
	let correct = 0;
	let mae = 0;
	for (let r = 0; r < rec.n; r++) {
		if (!filter(r)) continue;
		const p = probAt(rec, model, r, map);
		const y = rec.outcome[r];
		const pc = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
		n++;
		brier += (p - y) ** 2;
		logloss -= y * Math.log(pc) + (1 - y) * Math.log(1 - pc);
		if (y !== 0.5) {
			decided++;
			correct += p === 0.5 ? 0.5 : p > 0.5 === (y === 1) ? 1 : 0;
		}
		const o = (r * M + model) * STRIDE;
		mae += Math.abs(rec.pred[o + 3] - rec.redNp[r]) + Math.abs(rec.pred[o + 4] - rec.blueNp[r]);
	}
	return {
		n,
		brier: brier / n,
		logloss: logloss / n,
		accuracy: correct / decided,
		mae: mae / (2 * n)
	};
}

function brierOnly(rec: Records, model: number, map: Mapping, rows: Int32Array): number {
	let total = 0;
	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		total += (probAt(rec, model, r, map) - rec.outcome[r]) ** 2;
	}
	return total / rows.length;
}

function golden(f: (x: number) => number, lo: number, hi: number, iters = 32): number {
	const g = (Math.sqrt(5) - 1) / 2;
	let a = lo;
	let b = hi;
	let c = b - g * (b - a);
	let d = a + g * (b - a);
	let fc = f(c);
	let fd = f(d);
	for (let i = 0; i < iters; i++) {
		if (fc < fd) {
			b = d;
			d = c;
			fd = fc;
			c = b - g * (b - a);
			fc = f(c);
		} else {
			a = c;
			c = d;
			fc = fd;
			d = a + g * (b - a);
			fd = f(d);
		}
	}
	return (a + b) / 2;
}

export function rowsOf(rec: Records, filter: Filter): Int32Array {
	const out: number[] = [];
	for (let r = 0; r < rec.n; r++) if (filter(r)) out.push(r);
	return Int32Array.from(out);
}

export type FitOptions = { links?: Link[]; etas?: number[]; gammas?: number[] };

export function fitMapping(
	rec: Records,
	model: number,
	rows: Int32Array,
	opts: FitOptions = {}
): Mapping {
	let best: Mapping = { link: 'probit', kappa: 1, eta: 0, gamma: 0 };
	let bestLoss = Infinity;
	for (const link of opts.links ?? ['probit']) {
		for (const eta of opts.etas ?? [0]) {
			for (const gamma of opts.gammas ?? [0]) {
				const logK = golden(
					(x) => brierOnly(rec, model, { link, kappa: Math.exp(x), eta, gamma }, rows),
					Math.log(0.05),
					Math.log(20)
				);
				const map: Mapping = { link, kappa: Math.exp(logK), eta, gamma };
				const loss = brierOnly(rec, model, map, rows);
				if (loss < bestLoss) {
					bestLoss = loss;
					best = map;
				}
			}
		}
	}
	return best;
}

export function trainBrier(
	rec: Records,
	model: number,
	rows: Int32Array,
	opts: FitOptions = {}
): number {
	return brierOnly(rec, model, fitMapping(rec, model, rows, opts), rows);
}

export type CalibrationBin = {
	lo: number;
	hi: number;
	n: number;
	predicted: number;
	observed: number;
};

export function calibration(
	rec: Records,
	model: number,
	map: Mapping,
	filter: Filter,
	bins = 10
): CalibrationBin[] {
	const out: CalibrationBin[] = Array.from({ length: bins }, (_, i) => ({
		lo: i / bins,
		hi: (i + 1) / bins,
		n: 0,
		predicted: 0,
		observed: 0
	}));
	for (let r = 0; r < rec.n; r++) {
		if (!filter(r)) continue;
		const p = probAt(rec, model, r, map);
		const bin = out[Math.min(bins - 1, Math.floor(p * bins))];
		bin.n++;
		bin.predicted += p;
		bin.observed += rec.outcome[r];
	}
	for (const bin of out) {
		if (bin.n) {
			bin.predicted /= bin.n;
			bin.observed /= bin.n;
		}
	}
	return out;
}

export function pairedGap(
	rec: Records,
	a: number,
	b: number,
	mapA: Mapping,
	mapB: Mapping,
	filter: Filter
): { diff: number; se: number } {
	let n = 0;
	let sum = 0;
	let sq = 0;
	for (let r = 0; r < rec.n; r++) {
		if (!filter(r)) continue;
		const y = rec.outcome[r];
		const d = (probAt(rec, a, r, mapA) - y) ** 2 - (probAt(rec, b, r, mapB) - y) ** 2;
		n++;
		sum += d;
		sq += d * d;
	}
	const mean = sum / n;
	return { diff: mean, se: Math.sqrt(Math.max(sq / n - mean * mean, 0) / n) };
}
