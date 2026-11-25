import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Records } from '../../engine.ts';
import { FEATURES } from './probe.ts';

export const DIR = join(import.meta.dirname, '.records');

export type Dump = { rec: Records; feat: Float64Array; nf: number; hilo: Float64Array | null };

const ARRAYS = [
	'season',
	'playoff',
	'early',
	'official',
	'outcome',
	'sd',
	'mean',
	'unc',
	'redNp',
	'blueNp',
	'pred'
] as const;

const CTORS = {
	season: Int16Array,
	playoff: Uint8Array,
	early: Uint8Array,
	official: Uint8Array,
	outcome: Float64Array,
	sd: Float64Array,
	mean: Float64Array,
	unc: Float64Array,
	redNp: Float64Array,
	blueNp: Float64Array,
	pred: Float64Array
};

export async function save(
	name: string,
	rec: Records,
	features: Map<string, Float64Array>,
	hilo?: Map<string, Float64Array>
) {
	const dir = join(DIR, name);
	await mkdir(dir, { recursive: true });
	const nf = FEATURES.length;
	const feat = new Float64Array(rec.n * nf);
	for (let r = 0; r < rec.n; r++) feat.set(features.get(rec.keys[r])!, r * nf);
	for (const key of ARRAYS) {
		const a = rec[key].subarray(0, key === 'pred' ? rec.n * rec.models.length * 5 : rec.n);
		await writeFile(join(dir, `${key}.bin`), new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
	}
	await writeFile(join(dir, 'feat.bin'), new Uint8Array(feat.buffer));
	if (hilo) {
		const h = new Float64Array(rec.n * 4);
		for (let r = 0; r < rec.n; r++) h.set(hilo.get(rec.keys[r])!, r * 4);
		await writeFile(join(dir, 'hilo.bin'), new Uint8Array(h.buffer));
	}
	await writeFile(
		join(dir, 'meta.json'),
		JSON.stringify({ n: rec.n, models: rec.models, features: FEATURES, keys: rec.keys })
	);
}

export async function load(name: string): Promise<Dump> {
	const dir = join(DIR, name);
	const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8')) as {
		n: number;
		models: string[];
		features: string[];
		keys: string[];
	};
	const rec = { n: meta.n, models: meta.models, keys: meta.keys } as Records;
	for (const key of ARRAYS) {
		const buf = await readFile(join(dir, `${key}.bin`));
		const copy = new Uint8Array(buf.byteLength);
		copy.set(buf);
		(rec as Record<string, unknown>)[key] = new CTORS[key](copy.buffer);
	}
	const fb = await readFile(join(dir, 'feat.bin'));
	const fcopy = new Uint8Array(fb.byteLength);
	fcopy.set(fb);
	const hpath = join(dir, 'hilo.bin');
	let hilo: Float64Array | null = null;
	if (existsSync(hpath)) {
		const hb = await readFile(hpath);
		const hcopy = new Uint8Array(hb.byteLength);
		hcopy.set(hb);
		hilo = new Float64Array(hcopy.buffer);
	}
	return { rec, feat: new Float64Array(fcopy.buffer), nf: meta.features.length, hilo };
}
