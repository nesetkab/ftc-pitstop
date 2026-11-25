import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../../engine.ts';
import { rowsOf, trainBrier, score, type FitOptions } from '../../metrics.ts';
import type { Model, OprParams } from '../../models.ts';
import { ENGINE, seasons, TRAIN } from '../harness.ts';
import { shippedComp, type CompParams } from './comp.ts';
import { attach } from './data.ts';

export const SHIPPED = JSON.parse(
	await readFile(join(import.meta.dirname, '..', '..', 'params.json'), 'utf8')
).candidates['opr-map'] as OprParams;

export const BASE: CompParams = shippedComp(SHIPPED as unknown as Record<string, number>);

export async function data(list?: number[]) {
	const out = await seasons(list);
	attach(out);
	return out;
}

export const TUNE_FIT: FitOptions = { links: ['logit'], etas: [0.1, 0.2], gammas: [0.25, 0.375] };

export async function trainLoss(models: Model[], list: number[] = TRAIN): Promise<number[]> {
	const rec = run(await data(list), models, ENGINE);
	const rows = rowsOf(rec, () => true);
	return models.map((_, k) => trainBrier(rec, k, rows, TUNE_FIT));
}

export async function trainMae(models: Model[], list: number[] = TRAIN): Promise<number[]> {
	const rec = run(await data(list), models, ENGINE);
	const map = { link: 'logit' as const, kappa: 1, eta: 0, gamma: 0 };
	return models.map((_, k) => score(rec, k, map, () => true).mae);
}

export async function search<T extends Record<string, unknown>>(
	label: string,
	start: T,
	space: Record<string, number[]>,
	make: (p: T, name: string) => Model,
	opts: { list?: number[]; passes?: number; loss?: typeof trainLoss } = {}
): Promise<T> {
	const loss = opts.loss ?? trainLoss;
	let best = { ...start };
	let bestLoss = (await loss([make(best, 'start')], opts.list))[0];
	console.log(`tune ${label}: start ${bestLoss.toFixed(5)}`);
	for (let pass = 0; pass < (opts.passes ?? 2); pass++) {
		let improved = false;
		for (const [key, values] of Object.entries(space)) {
			const options = values.map((v) => ({ ...best, [key]: v }));
			const losses = await loss(
				options.map((o, j) => make(o, `${key}=${values[j]}`)),
				opts.list
			);
			const i = losses.indexOf(Math.min(...losses));
			console.log(`  ${key}: ${values.map((v, j) => `${v}=${losses[j].toFixed(5)}`).join(' ')}`);
			if (losses[i] < bestLoss - 1e-7) {
				bestLoss = losses[i];
				best = options[i];
				improved = true;
			}
		}
		console.log(`  pass ${pass}: ${bestLoss.toFixed(5)} ${JSON.stringify(best)}`);
		if (!improved) break;
	}
	return best;
}
