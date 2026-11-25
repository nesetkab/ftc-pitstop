import { previousFrom, rateSeason } from '../../src/lib/model/opr.ts';
import previousSeason from '../../src/lib/model/previous-2025.json' with { type: 'json' };
import { WIN_PARAMS } from '../../src/lib/model/predict.ts';
import { run, STRIDE, type Records } from './engine.ts';
import { probAt, type Mapping } from './metrics.ts';
import { ALL, ENGINE, FULL_FIT, print, report, shipped } from './lab/harness.ts';
import { build } from './lab/final/model.ts';
import { data } from './lab/robot/setup.ts';
import { productionRecords, toModelEvent } from './production.ts';

const seasons = await data(ALL);
const rec = run(seasons, [await shipped(), build('final')], ENGINE);
const prod = productionRecords(rec, seasons, 'production');
const M = rec.models.length;
const at = (r: number, k: number) =>
	rec.pred.subarray((r * M + k) * STRIDE, (r * M + k + 1) * STRIDE);
const map: Mapping = {
	link: WIN_PARAMS.link,
	kappa: WIN_PARAMS.kappa,
	eta: WIN_PARAMS.eta,
	gamma: WIN_PARAMS.gamma
};
const single = (k: number): Records => {
	const pred = new Float64Array(rec.n * STRIDE);
	for (let r = 0; r < rec.n; r++) pred.set(at(r, k), r * STRIDE);
	return { ...rec, models: [rec.models[k]], pred };
};
const final = single(1);

type Worst = { n: number; margin: number; score: number; variance: number; win: number };
const worst: Record<number, Worst> = {};
for (let r = 0; r < rec.n; r++) {
	const a = at(r, 1);
	const b = prod.pred.subarray(r * STRIDE, (r + 1) * STRIDE);
	const w = (worst[rec.season[r]] ??= { n: 0, margin: 0, score: 0, variance: 0, win: 0 });
	w.n++;
	w.margin = Math.max(w.margin, Math.abs(a[0] - a[1] - (b[0] - b[1])), Math.abs(a[0] - b[0]));
	w.score = Math.max(w.score, Math.abs(a[3] - b[3]), Math.abs(a[4] - b[4]));
	w.variance = Math.max(w.variance, Math.abs(a[2] - b[2]));
	w.win = Math.max(w.win, Math.abs(probAt(final, 0, r, map) - probAt(prod, 0, r, map)));
}
console.log('max |difference|, production rateSeason vs backtest final model');
console.log(
	'season'.padEnd(8),
	'n'.padStart(7),
	'margin'.padStart(10),
	'score'.padStart(10),
	'variance'.padStart(10),
	'win'.padStart(10)
);
for (const [s, w] of Object.entries(worst))
	console.log(
		s.padEnd(8),
		String(w.n).padStart(7),
		...[w.margin, w.score, w.variance, w.win].map((x) => x.toExponential(2).padStart(10))
	);

const baked = new Map<string, number>();
rateSeason(seasons[seasons.length - 1].map(toModelEvent), {
	previous: previousFrom(previousSeason),
	onForecast: (_e, m, f) => baked.set(`2026:${m.key}`, f.red.strength - f.blue.strength)
});
let bakedGap = 0;
for (let r = 0; r < rec.n; r++) {
	const b = prod.pred.subarray(r * STRIDE, (r + 1) * STRIDE);
	if (rec.season[r] === 2026)
		bakedGap = Math.max(bakedGap, Math.abs(baked.get(rec.keys[r])! - (b[0] - b[1])));
}
console.log(
	`2026 with the baked, rounded priors file: max margin difference ${bakedGap.toExponential(2)}`
);

const all = new Float64Array(rec.n * (M + 1) * STRIDE);
for (let r = 0; r < rec.n; r++) {
	for (let k = 0; k < M; k++) all.set(at(r, k), (r * (M + 1) + k) * STRIDE);
	all.set(prod.pred.subarray(r * STRIDE, (r + 1) * STRIDE), (r * (M + 1) + M) * STRIDE);
}
const reports = report({ ...rec, models: [...rec.models, 'production'], pred: all }, FULL_FIT);
console.log();
print(reports);
for (const r of reports) console.log(r.name, JSON.stringify(r.mapping));

const test = worst[2026];
if (!test || Math.max(test.margin, test.score, test.win) > 1e-6) {
	console.error('production does not match the backtest model on 2026');
	process.exit(1);
}
