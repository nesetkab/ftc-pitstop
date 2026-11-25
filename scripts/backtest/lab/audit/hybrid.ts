import { run } from '../../engine.ts';
import { fitMapping, probAt, rowsOf, type FitOptions } from '../../metrics.ts';
import type { KalmanOpr, Model } from '../../models.ts';
import { ALL, seasons, shipped, TEST, TRAIN } from '../harness.ts';
import { LiveOpr, PriorFallbackOpr } from './baselines.ts';
import { load } from './oddbot.ts';

const SIMPLE: FitOptions = { links: ['logit'], etas: [0], gammas: [0] };

const models: Model[] = [
	new LiveOpr('event opr best', 'best'),
	new PriorFallbackOpr('event opr, shipped win prior', (await shipped()) as KalmanOpr, false),
	new PriorFallbackOpr('event opr, shipped points prior', (await shipped()) as KalmanOpr, true)
];
const evts = await seasons(ALL);
const rec = run(evts, models, { halfLife: Infinity, warmup: 0 });

const first = new Map<number, number>();
for (let r = 0; r < rec.n; r++) if (!first.has(rec.season[r])) first.set(rec.season[r], r);
const warm = (r: number) => r - first.get(rec.season[r])! >= 30;
const train = new Set(TRAIN);
const odd = await load(TEST);
const matched = (r: number) => rec.season[r] === TEST && odd.has(rec.keys[r]);

function stats(prob: (r: number) => number, f: (r: number) => boolean) {
	let n = 0;
	let b = 0;
	let hit = 0;
	for (let r = 0; r < rec.n; r++) {
		if (!f(r)) continue;
		const p = prob(r);
		const y = rec.outcome[r];
		n++;
		b += (p - y) ** 2;
		hit += y === 0.5 ? 0 : p === 0.5 ? 0.5 : p > 0.5 === (y === 1) ? 1 : 0;
	}
	return `${String(n).padStart(5)} ${(b / n).toFixed(4)} ${((hit / n) * 100).toFixed(1)}%`;
}

const sets: [string, (r: number) => boolean][] = [
	['oddbot', matched],
	['oddbot quals', (r) => matched(r) && rec.playoff[r] === 0],
	['oddbot playoffs', (r) => matched(r) && rec.playoff[r] === 1]
];
models.forEach((m, k) => {
	for (const [label, rows] of [
		['train fit', rowsOf(rec, (r) => train.has(rec.season[r]) && warm(r))],
		['2026 in-sample', rowsOf(rec, (r) => rec.season[r] === TEST && warm(r))]
	] as const) {
		const map = fitMapping(rec, k, rows, SIMPLE);
		const prob = (r: number) => probAt(rec, k, r, map);
		for (const [name, f] of sets) console.log(m.name.padEnd(32), label.padEnd(15), name.padEnd(16), stats(prob, f));
	}
});
