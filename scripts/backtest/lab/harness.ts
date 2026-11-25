import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build, CANDIDATES } from '../candidates.ts';
import { run, type Records } from '../engine.ts';
import { loadSeason } from '../hist.ts';
import {
	fitMapping,
	pairedGap,
	rowsOf,
	score,
	type FitOptions,
	type Mapping,
	type Scores
} from '../metrics.ts';
import type { EpaParams, Model, OprParams } from '../models.ts';
import { prepSeason, type PEvent } from '../prep.ts';

export const TRAIN = [2021, 2022, 2023, 2024, 2025];
export const TEST = 2026;
export const ALL = [...TRAIN, TEST];
export const ENGINE = { halfLife: Infinity, warmup: 30 };
export const FULL_FIT: FitOptions = {
	links: ['probit', 'logit'],
	etas: [0, 0.025, 0.05, 0.1, 0.15, 0.2, 0.3],
	gammas: [0, 0.125, 0.25, 0.375, 0.5]
};
export const QUICK_FIT: FitOptions = { links: ['logit'], etas: [0, 0.1, 0.2], gammas: [0, 0.25] };

const RESULTS = join(import.meta.dirname, 'results');
const cache = new Map<number, PEvent[]>();

export async function seasons(list: number[] = ALL): Promise<PEvent[][]> {
	const out: PEvent[][] = [];
	for (const s of list) {
		if (!cache.has(s)) cache.set(s, prepSeason(await loadSeason(s)));
		out.push(cache.get(s)!);
	}
	return out;
}

export async function shipped(): Promise<Model> {
	const stored = JSON.parse(
		await readFile(join(import.meta.dirname, '..', 'params.json'), 'utf8')
	) as { candidates: Record<string, OprParams | EpaParams> };
	const c = CANDIDATES.find((x) => x.id === 'opr-map')!;
	const model = build(c, stored.candidates['opr-map']);
	model.name = 'shipped';
	return model;
}

export type Slice = { brier: number; logloss: number; accuracy: number; mae: number; n: number };

export type Report = {
	name: string;
	mapping: Mapping;
	train: Slice;
	test: Slice;
	testQuals: Slice;
	testPlayoffs: Slice;
	bySeason: Record<number, Slice>;
	gapVsShipped: { diff: number; se: number };
};

const slice = (s: Scores): Slice => ({
	brier: Number(s.brier.toFixed(5)),
	logloss: Number(s.logloss.toFixed(5)),
	accuracy: Number(s.accuracy.toFixed(4)),
	mae: Number(s.mae.toFixed(2)),
	n: s.n
});

export function report(rec: Records, fit: FitOptions = FULL_FIT): Report[] {
	const inSeasons = (list: number[]) => {
		const set = new Set(list);
		return (r: number) => set.has(rec.season[r]);
	};
	const train = inSeasons(TRAIN);
	const test = inSeasons([TEST]);
	const trainRows = rowsOf(rec, train);
	const maps = rec.models.map((_, k) => fitMapping(rec, k, trainRows, fit));
	const base = rec.models.indexOf('shipped');
	return rec.models.map((name, k) => {
		const bySeason: Record<number, Slice> = {};
		for (const s of ALL) bySeason[s] = slice(score(rec, k, maps[k], inSeasons([s])));
		return {
			name,
			mapping: maps[k],
			train: slice(score(rec, k, maps[k], train)),
			test: slice(score(rec, k, maps[k], test)),
			testQuals: slice(score(rec, k, maps[k], (r) => test(r) && rec.playoff[r] === 0)),
			testPlayoffs: slice(score(rec, k, maps[k], (r) => test(r) && rec.playoff[r] === 1)),
			bySeason,
			gapVsShipped:
				base >= 0 ? pairedGap(rec, k, base, maps[k], maps[base], test) : { diff: 0, se: 0 }
		};
	});
}

export function print(reports: Report[]): void {
	const pct = (x: number) => (x * 100).toFixed(1).padStart(6);
	const b = (x: number) => x.toFixed(4).padStart(7);
	console.log(
		'model'.padEnd(28),
		'trainB'.padStart(7),
		'2026B'.padStart(7),
		'2026acc'.padStart(7),
		'qualB'.padStart(7),
		'qualAcc'.padStart(7),
		'poB'.padStart(7),
		'poAcc'.padStart(7),
		'mae'.padStart(6),
		'gap'.padStart(9),
		'se'.padStart(8)
	);
	for (const r of reports) {
		console.log(
			r.name.slice(0, 28).padEnd(28),
			b(r.train.brier),
			b(r.test.brier),
			pct(r.test.accuracy),
			b(r.testQuals.brier),
			pct(r.testQuals.accuracy),
			b(r.testPlayoffs.brier),
			pct(r.testPlayoffs.accuracy),
			r.test.mae.toFixed(2).padStart(6),
			r.gapVsShipped.diff.toFixed(5).padStart(9),
			r.gapVsShipped.se.toFixed(5).padStart(8)
		);
	}
	const t = reports[0]?.test.n;
	console.log(
		`2026 matches: ${t}, quals ${reports[0]?.testQuals.n}, playoffs ${reports[0]?.testPlayoffs.n}`
	);
}

export async function evaluate(
	label: string,
	models: Model[],
	opts: { seasons?: number[]; fit?: FitOptions; withShipped?: boolean } = {}
): Promise<Report[]> {
	const list = opts.seasons ?? ALL;
	const all = opts.withShipped === false ? models : [await shipped(), ...models];
	const t0 = Date.now();
	const rec = run(await seasons(list), all, ENGINE);
	const reports = report(rec, opts.fit ?? FULL_FIT);
	console.log(`\n== ${label} (${rec.n} matches, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
	print(reports);
	await mkdir(RESULTS, { recursive: true });
	await writeFile(join(RESULTS, `${label}.json`), `${JSON.stringify(reports, null, '\t')}\n`);
	return reports;
}
