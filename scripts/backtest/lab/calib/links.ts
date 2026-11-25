import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from './data.ts';
import { columns, type Cols } from './cols.ts';
import { Ctx, nelderMead, normalCdf, printRows, sigmoid, tCdf, type Row } from './lib.ts';

type Variant = {
	name: string;
	x0: number[];
	p: (x: number[], r: number, c: Cols) => number;
};

const pos = (v: number) => Math.exp(v);

function scale2(x: number[], r: number, c: Cols, extra: number): number {
	const v = c.vf[r] + pos(x[1]) * c.unc[r] + extra;
	return pos(x[0]) * c.sd[r] * Math.sqrt(Math.max(v, 1e-6)) * c.lvl[r] ** x[2];
}

const penVar = (x: number, r: number, c: Cols) =>
	(c.evPenVar[r] + pos(x) * c.sePenVar[r]) / (c.evPenN[r] + pos(x));
const resVar = (x: number, r: number, c: Cols) =>
	(c.evResVar[r] + pos(x) * c.seResVar[r]) / (c.evResN[r] + pos(x)) / c.seResVar[r];

const base = [Math.log(0.4), Math.log(0.2), 0.375];

const VARIANTS: Variant[] = [
	{
		name: 'logit continuous refit',
		x0: base,
		p: (x, r, c) => sigmoid(c.m[r] / scale2(x, r, c, 0))
	},
	{
		name: 'probit continuous refit',
		x0: [Math.log(0.7), Math.log(0.2), 0.375],
		p: (x, r, c) => normalCdf(c.m[r] / scale2(x, r, c, 0))
	},
	{
		name: 'student-t link',
		x0: [Math.log(0.7), Math.log(0.2), 0.375, Math.log(8)],
		p: (x, r, c) => tCdf(c.m[r] / scale2(x, r, c, 0), pos(x[3]))
	},
	{
		name: 'logit+probit mix',
		x0: [Math.log(0.4), Math.log(0.2), 0.375, 0],
		p: (x, r, c) => {
			const z = c.m[r] / scale2(x, r, c, 0);
			const w = sigmoid(x[3]);
			return w * sigmoid(z) + (1 - w) * normalCdf(z * 0.588);
		}
	},
	{
		name: 'playoff scale',
		x0: [...base, 0],
		p: (x, r, c) => sigmoid(c.m[r] / (scale2(x, r, c, 0) * Math.exp(x[3] * c.po[r])))
	},
	{
		name: 'official/champ scale',
		x0: [...base, 0, 0],
		p: (x, r, c) =>
			sigmoid(c.m[r] / (scale2(x, r, c, 0) * Math.exp(x[3] * c.off[r] + x[4] * c.champ[r])))
	},
	{
		name: 'week of season scale',
		x0: [...base, 0],
		p: (x, r, c) =>
			sigmoid(c.m[r] / (scale2(x, r, c, 0) * Math.exp((x[3] * Math.min(c.week[r], 30)) / 10)))
	},
	{
		name: 'penalty variance',
		x0: [...base, Math.log(0.3), Math.log(10)],
		p: (x, r, c) => sigmoid(c.m[r] / scale2(x, r, c, pos(x[3]) * penVar(x[4], r, c)))
	},
	{
		name: 'season penalty variance',
		x0: [...base, Math.log(0.3)],
		p: (x, r, c) => sigmoid(c.m[r] / scale2(x, r, c, pos(x[3]) * c.sePenVar[r]))
	},
	{
		name: 'event noise scale',
		x0: [...base, 0, Math.log(20)],
		p: (x, r, c) => sigmoid(c.m[r] / (scale2(x, r, c, 0) * resVar(x[4], r, c) ** x[3]))
	},
	{
		name: 'team consistency scale',
		x0: [...base, 0],
		p: (x, r, c) =>
			sigmoid(c.m[r] / (scale2(x, r, c, 0) * (c.cons[r] / c.seResVar[r]) ** x[3]))
	},
	{
		name: 'margin-dependent shrink',
		x0: [...base, 0],
		p: (x, r, c) => {
			const z = c.m[r] / scale2(x, r, c, 0);
			return sigmoid(z / (1 + Math.abs(x[3]) * Math.abs(z)));
		}
	},
	{
		name: 'carry term',
		x0: [...base, 0],
		p: (x, r, c) => sigmoid((c.m[r] + x[3] * c.carry[r] * c.sd[r]) / scale2(x, r, c, 0))
	},
	{
		name: 'red bias',
		x0: [...base, 0],
		p: (x, r, c) => sigmoid(c.m[r] / scale2(x, r, c, 0) + x[3])
	},
	{
		name: 'combo heteroscedastic',
		x0: [...base, 0, 0, 0, Math.log(0.3), Math.log(10), 0, Math.log(20)],
		p: (x, r, c) => {
			const s =
				scale2(x, r, c, pos(x[6]) * penVar(x[7], r, c)) *
				Math.exp(x[3] * c.po[r] + x[4] * c.off[r] + x[5] * c.champ[r]) *
				resVar(x[9], r, c) ** x[8];
			return sigmoid(c.m[r] / s);
		}
	}
];

const dump = await load(process.argv[2] ?? 'main');
const ctx = new Ctx(dump);
const cols = columns(ctx);
console.log('shipped mapping', ctx.baseMap);
const rows: Row[] = [ctx.row('shipped (grid refit)', ctx.base)];
const fitted: Record<string, number[]> = {};
for (const v of VARIANTS) {
	const fit = (train: Int32Array) => {
		const loss = (x: number[]) => {
			let s = 0;
			for (let i = 0; i < train.length; i++) {
				const r = train[i];
				s += (v.p(x, r, cols) - ctx.rec.outcome[r]) ** 2;
			}
			return s / train.length;
		};
		let best = nelderMead(loss, v.x0, 0.2, 300);
		best = nelderMead(loss, best.x, 0.05, 300);
		return best.x;
	};
	const x = fit(ctx.train);
	fitted[v.name] = x;
	const p = new Float64Array(ctx.rec.n);
	for (let r = 0; r < ctx.rec.n; r++) p[r] = v.p(x, r, cols);
	const row = ctx.row(v.name, p);
	rows.push(row);
	console.log(v.name, x.map((a) => a.toFixed(3)).join(' '));
	printRows([row]);
}
console.log();
printRows(rows);
const out = join(import.meta.dirname, 'results');
await mkdir(out, { recursive: true });
await writeFile(join(out, 'links.json'), `${JSON.stringify({ rows, fitted }, null, '\t')}\n`);
