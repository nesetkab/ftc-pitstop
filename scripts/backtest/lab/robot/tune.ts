import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Model } from '../../models.ts';
import { trainLoss } from './setup.ts';
import { VARIANTS } from './variants.ts';

type Flat = Record<string, unknown>;

const DIR = join(import.meta.dirname, 'params');

function get(p: Flat, path: string): number {
	return (path.split('.').reduce((o: any, k) => o?.[k], p) as number) ?? 0;
}

function set(p: Flat, path: string, v: number): Flat {
	const out = structuredClone(p);
	const keys = path.split('.');
	let o: any = out;
	for (const k of keys.slice(0, -1)) o = o[k];
	if (Array.isArray(o) || keys.length === 1 || typeof o === 'object') o[keys[keys.length - 1]] = v;
	return out;
}

function grid(path: string, x: number): number[] {
	const name = path.split('.').pop()!;
	const r = (v: number) => Number(v.toPrecision(3));
	const mult = (fs: number[]) => fs.map((f) => r(x * f));
	const add = (ds: number[], lo = -Infinity, hi = Infinity) =>
		ds.map((d) => r(Math.min(hi, Math.max(lo, x + d))));
	let vals: number[];
	if (['lamNew', 'lamPrev', 'robotNoise', 'k0', 'kMin', 'tau', 'clip', 'kNew'].includes(name))
		vals = mult([0.6, 0.8, 1, 1.25, 1.6]);
	else if (['q', 'qWeek', 'qMatch', 'wk', 'scoreCommon', 'scoreQ'].includes(name))
		vals = x > 0 ? mult([0, 0.5, 1, 1.5, 2.5]) : [0, 0.005, 0.01, 0.03, 0.1];
	else if (['rVar', 'aVar'].includes(name)) vals = [0, 0.25, 0.5, 1, 2];
	else if (['gate', 'reset', 'carry'].includes(name)) vals = add([-0.2, -0.1, 0, 0.1, 0.2], 0, 1.2);
	else if (name === 'drift') vals = add([-0.25, -0.1, 0, 0.1, 0.25], 0, 1.5);
	else if (/^\d+$/.test(name)) vals = add([-0.3, -0.15, 0, 0.15, 0.3], 0, 2);
	else vals = add([-0.15, -0.075, 0, 0.075, 0.15], 0, 3);
	return [...new Set(vals)];
}

const [variant, seasonArg, ...keys] = process.argv.slice(2);
const list = seasonArg.split(',').map(Number);
const [vname, file] = variant.split('@');
const v = VARIANTS[vname];
await mkdir(DIR, { recursive: true });
const path = join(DIR, `${file ?? vname}.json`);
let best: Flat = existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : v.start;
const t0 = Date.now();
let bestLoss = Infinity;
for (const key of keys) {
	const values = grid(key, get(best, key));
	const options = values.map((x) => set(best, key, x));
	const models: Model[] = options.map((o, j) => v.make(o, `${key}=${values[j]}`));
	const losses = await trainLoss(models, list);
	const i = losses.indexOf(Math.min(...losses));
	const cur = values.indexOf(get(best, key));
	if (cur >= 0) bestLoss = losses[cur];
	console.log(
		`${key}: ${values.map((x, j) => `${x}=${losses[j].toFixed(5)}`).join(' ')} (${((Date.now() - t0) / 1000).toFixed(0)}s)`
	);
	if (losses[i] < bestLoss - 2e-6) {
		best = options[i];
		bestLoss = losses[i];
	}
	await writeFile(path, `${JSON.stringify(best, null, '\t')}\n`);
}
console.log(`best ${bestLoss.toFixed(5)} ${JSON.stringify(best)}`);
