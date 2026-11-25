import { TRAIN } from '../harness.ts';
import { columns, type Cols } from './cols.ts';
import { load } from './data.ts';
import { Ctx, nelderMead, printRows, sigmoid, type Row } from './lib.ts';

const dump = await load(process.argv[2] ?? 'main');
const ctx = new Ctx(dump);
const cols = columns(ctx);
const n = ctx.rec.n;
const half = (r: number) => ctx.rec.mean[r] / 2;
const rel = (r: number, name: 'redHi' | 'redLo' | 'blueHi' | 'blueLo') =>
	ctx.f(r, name) / (half(r) || 1);

let neg = 0;
let two = 0;
for (let r = 0; r < n; r++) {
	if (ctx.f(r, 'redSize') === 2 && ctx.f(r, 'blueSize') === 2) two++;
	if (rel(r, 'redLo') < 0) neg++;
}
console.log(`two-team alliances ${two}/${n}, negative red lo ${neg}`);
const q = (name: 'redHi' | 'redLo') => {
	const v = Array.from(ctx.train, (r) => rel(r, name)).sort((a, b) => a - b);
	return [0.01, 0.1, 0.5, 0.9, 0.99].map((p) => v[Math.floor(p * v.length)].toFixed(2)).join(' ');
};
console.log('redHi rel quantiles', q('redHi'));
console.log('redLo rel quantiles', q('redLo'));

type Variant = { name: string; x0: number[]; m: (x: number[], r: number) => number };

const scale = (x: number[], r: number, c: Cols) =>
	Math.exp(x[0]) *
	c.sd[r] *
	Math.sqrt(c.vf[r] + Math.exp(x[1]) * c.unc[r]) *
	c.lvl[r] ** x[2];
const base = [-0.9, -1.5, 0.37];
const soft = (v: number, floor: number, w: number) =>
	floor + w * Math.log1p(Math.exp((v - floor) / w));
const pmean = (a: number, b: number, e: number) => {
	const u = Math.max(a, 1e-3);
	const v = Math.max(b, 1e-3);
	return 2 * ((u ** e + v ** e) / 2) ** (1 / e);
};

const VARIANTS: Variant[] = [
	{ name: 'plain', x0: base, m: (_x, r) => cols.m[r] },
	{
		name: 'carry',
		x0: [...base, 0.15],
		m: (x, r) => cols.m[r] + x[3] * cols.carry[r] * cols.sd[r]
	},
	{
		name: 'carry quals/playoffs',
		x0: [...base, 0.15, 0.15],
		m: (x, r) => cols.m[r] + (cols.po[r] ? x[4] : x[3]) * cols.carry[r] * cols.sd[r]
	},
	{
		name: 'floor on team rating',
		x0: [...base, 0.2],
		m: (x, r) => {
			const f = x[3];
			const g = (k: 'redHi' | 'redLo' | 'blueHi' | 'blueLo') => Math.max(rel(r, k), f);
			return (g('redHi') + g('redLo') - g('blueHi') - g('blueLo')) * half(r);
		}
	},
	{
		name: 'soft floor on team rating',
		x0: [...base, 0.2, -1],
		m: (x, r) => {
			const w = Math.exp(x[4]);
			const g = (k: 'redHi' | 'redLo' | 'blueHi' | 'blueLo') => soft(rel(r, k), x[3], w);
			return (g('redHi') + g('redLo') - g('blueHi') - g('blueLo')) * half(r);
		}
	},
	{
		name: 'power mean alliance',
		x0: [...base, 1.5],
		m: (x, r) =>
			(pmean(rel(r, 'redHi'), rel(r, 'redLo'), x[3]) -
				pmean(rel(r, 'blueHi'), rel(r, 'blueLo'), x[3])) *
			half(r)
	},
	{
		name: 'carry + soft floor',
		x0: [...base, 0.15, 0.2, -1],
		m: (x, r) => {
			const w = Math.exp(x[5]);
			const g = (k: 'redHi' | 'redLo' | 'blueHi' | 'blueLo') => soft(rel(r, k), x[4], w);
			const rh = g('redHi');
			const rl = g('redLo');
			const bh = g('blueHi');
			const bl = g('blueLo');
			return (rh + rl - bh - bl + x[3] * (rh - rl - (bh - bl))) * half(r);
		}
	},
	{
		name: 'carry x new teams',
		x0: [...base, 0.15, 0],
		m: (x, r) => cols.m[r] + (x[3] + x[4] * cols.first[r]) * cols.carry[r] * cols.sd[r]
	},
	{
		name: 'carry x matches played',
		x0: [...base, 0.15, 0],
		m: (x, r) =>
			cols.m[r] + (x[3] + x[4] * Math.log1p(cols.minPlayed[r])) * cols.carry[r] * cols.sd[r]
	}
];

const rows: Row[] = [ctx.row('shipped', ctx.base)];
for (const v of VARIANTS) {
	const p = (x: number[], r: number) => sigmoid(v.m(x, r) / scale(x, r, cols));
	const fit = (train: Int32Array) => {
		const loss = (x: number[]) => {
			let s = 0;
			for (let i = 0; i < train.length; i++) {
				const r = train[i];
				s += (p(x, r) - ctx.rec.outcome[r]) ** 2;
			}
			return s / train.length;
		};
		let best = nelderMead(loss, v.x0, 0.2, 300);
		best = nelderMead(loss, best.x, 0.05, 300);
		return best.x;
	};
	const res = ctx.cv((train) => {
		const x = fit(train);
		return (r) => p(x, r);
	});
	const x = fit(ctx.train);
	const bySeason = TRAIN.map((s) => ctx.brier(res.p, ctx.trainBySeason.get(s)!).toFixed(4));
	console.log(v.name, x.map((a) => a.toFixed(3)).join(' '), '| by season', bySeason.join(' '));
	const row = ctx.row(v.name, res.p, res.cv);
	rows.push(row);
	printRows([row]);
}
console.log();
printRows(rows);
