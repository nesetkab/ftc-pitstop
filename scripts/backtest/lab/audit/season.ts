import { run } from '../../engine.ts';
import { fitMapping, probAt, rowsOf, type FitOptions } from '../../metrics.ts';
import type { Model } from '../../models.ts';
import { seasons, TEST } from '../harness.ts';
import { LiveOpr, SeasonOpr } from './baselines.ts';
import { load } from './oddbot.ts';

const LIST = [2025, TEST];
const SIMPLE: FitOptions = { links: ['logit'], etas: [0], gammas: [0] };

const models: Model[] = [
	new LiveOpr('event opr best', 'best'),
	new SeasonOpr('season opr', [TEST]),
	new SeasonOpr('season opr +playoffs', [TEST], { playoffs: true })
];
const t0 = Date.now();
const evts = await seasons(LIST);
const rec = run(evts, models, { halfLife: Infinity, warmup: 0 });
console.log(`engine ${rec.n} rows in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

let start = 0;
while (rec.season[start] !== TEST) start++;
const month = new Array<string>(rec.n).fill('');
{
	let r = start;
	for (const e of evts[1]) for (const _ of e.matches) month[r++] = e.start.slice(0, 7);
}
const odd = await load(TEST);
const matched = (r: number) => r >= start && odd.has(rec.keys[r]);
const std = (r: number) => r >= start + 30;
const train = (r: number) => r < start && r >= 30;

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
	['ours', std],
	['oddbot', matched],
	['oddbot quals', (r) => matched(r) && rec.playoff[r] === 0],
	['oddbot playoffs', (r) => matched(r) && rec.playoff[r] === 1],
	['oddbot Oct', (r) => matched(r) && month[r] === '2026-10'],
	['oddbot Nov', (r) => matched(r) && month[r] === '2026-11']
];
const proxy = fitMapping(rec, 0, rowsOf(rec, train), SIMPLE);
console.log('2025 mapping of event opr, reused for season opr', proxy);
models.forEach((m, k) => {
	for (const [label, map] of [
		['2025 fit', proxy],
		['2026 in-sample', fitMapping(rec, k, rowsOf(rec, std), SIMPLE)]
	] as const) {
		const prob = (r: number) => probAt(rec, k, r, map);
		for (const [name, f] of sets) console.log(m.name.padEnd(22), label.padEnd(15), name.padEnd(16), stats(prob, f));
	}
});
const oddProb = (r: number) => odd.get(rec.keys[r])!.pRed;
for (const [name, f] of sets.slice(1)) console.log('oddbot EPA'.padEnd(22), 'theirs'.padEnd(15), name.padEnd(16), stats(oddProb, f));
