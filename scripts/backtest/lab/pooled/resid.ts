import { run } from '../../engine.ts';
import type { Ctx } from '../../models.ts';
import type { PMatch } from '../../prep.ts';
import { ENGINE, seasons } from '../harness.ts';
import type { PooledOpr } from './model.ts';
import { make } from './variants.ts';

const list = (process.argv[2] ?? '2024,2025,2026').split(',').map(Number);
const model = make('pooled-het') as PooledOpr;
const rows: { s: number; hi: number; lo: number; y: number; mean: number; sd: number }[] = [];
let season = 0;
const predict = model.predict.bind(model);
model.predict = (m: PMatch, ctx: Ctx) => {
	const out = predict(m, ctx);
	for (const [teams, y, ok] of [
		[m.redUpd, m.redNp, m.redOk],
		[m.blueUpd, m.blueNp, m.blueOk]
	] as const) {
		if (!ok || teams.length !== 2) continue;
		const idx = teams.map((t) => model.index.get(t)!);
		if (Math.min(...idx.map((i) => model.played[i])) < 3) continue;
		const v = idx.map((i) => model.nu[i]);
		rows.push({ s: season, hi: Math.max(...v), lo: Math.min(...v), y, mean: ctx.mean, sd: ctx.sd });
	}
	return out;
};
const start = model.startSeason.bind(model);
let k = 0;
model.startSeason = (prev) => {
	season = list[k++];
	start(prev);
};
run(await seasons(list), [model], ENGINE);

for (const s of list) {
	const rs = rows.filter((r) => r.s === s);
	const bins = new Map<number, { n: number; res: number; abs: number }>();
	for (const r of rs) {
		const imb = (r.hi - r.lo) / r.mean;
		const b = Math.min(Math.floor(imb / 0.2), 5);
		const e = bins.get(b) ?? { n: 0, res: 0, abs: 0 };
		e.n++;
		e.res += (r.y - r.hi - r.lo) / r.sd;
		e.abs += Math.abs(r.y - r.hi - r.lo) / r.sd;
		bins.set(b, e);
	}
	const lvl = new Map<number, { n: number; res: number; sq: number }>();
	for (const r of rs) {
		const b = Math.min(Math.floor(((r.hi + r.lo) / r.mean) / 0.25), 9);
		const e = lvl.get(b) ?? { n: 0, res: 0, sq: 0 };
		const z = (r.y - r.hi - r.lo) / r.sd;
		e.n++;
		e.res += z;
		e.sq += z * z;
		lvl.set(b, e);
	}
	console.log(`season ${s} imbalance (hi-lo)/mean bins of 0.2: mean resid / sd`);
	console.log(
		[...bins]
			.sort((a, b) => a[0] - b[0])
			.map(([b, e]) => `${b}:${e.n}:${(e.res / e.n).toFixed(3)}`)
			.join('  ')
	);
	console.log(`season ${s} level (hi+lo)/mean bins of 0.25: n, mean resid, resid sd`);
	console.log(
		[...lvl]
			.sort((a, b) => a[0] - b[0])
			.map(([b, e]) => `${b}:${e.n}:${(e.res / e.n).toFixed(3)}:${Math.sqrt(e.sq / e.n).toFixed(3)}`)
			.join('  ')
	);
}
