import { run } from '../../engine.ts';
import { rowsOf, trainBrier } from '../../metrics.ts';
import type { Model } from '../../models.ts';
import { ENGINE, QUICK_FIT, seasons, shipped } from '../harness.ts';
import { make } from './variants.ts';
import type { PooledParams } from './model.ts';

const args = process.argv.slice(2);
const flag = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const base = flag('base') ?? 'pooled';
const list = (flag('seasons') ?? '2024,2025').split(',').map(Number);
const space = JSON.parse(flag('space') ?? '{}') as Record<string, unknown[]>;
const passes = Number(flag('passes') ?? 2);
let best = JSON.parse(flag('extra') ?? '{}') as Partial<PooledParams>;
const data = await seasons(list);

function losses(models: Model[]): number[] {
	const t0 = Date.now();
	const rec = run(data, models, ENGINE);
	const rows = rowsOf(rec, () => true);
	const out = models.map((_, k) => trainBrier(rec, k, rows, QUICK_FIT));
	process.stdout.write(`(${((Date.now() - t0) / 1000).toFixed(0)}s) `);
	return out;
}

if (args.includes('--shipped')) console.log(`shipped ${losses([await shipped()])[0].toFixed(5)}`);
let bestLoss = losses([make(base, best)])[0];
console.log(`start ${bestLoss.toFixed(5)} ${JSON.stringify(best)}`);
for (let pass = 0; pass < passes; pass++) {
	let improved = false;
	for (const [key, values] of Object.entries(space)) {
		const options = values.map((v) => ({ ...best, [key]: v }));
		const ls = losses(options.map((o) => make(base, o as Partial<PooledParams>)));
		const i = ls.indexOf(Math.min(...ls));
		console.log(`${key}: ${values.map((v, j) => `${v}=${ls[j].toFixed(5)}`).join(' ')}`);
		if (ls[i] < bestLoss - 1e-6) {
			bestLoss = ls[i];
			best = options[i] as Partial<PooledParams>;
			improved = true;
		}
	}
	console.log(`pass ${pass}: ${bestLoss.toFixed(5)} ${JSON.stringify(best)}`);
	if (!improved) break;
}
