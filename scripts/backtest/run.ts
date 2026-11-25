import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OPR_PARAMS } from '../../src/lib/model/opr.ts';
import { blend, build, CANDIDATES, resolve, type Candidate, type Params } from './candidates.ts';
import { run, type Records } from './engine.ts';
import { loadSeason } from './hist.ts';
import {
	calibration,
	fitMapping,
	pairedGap,
	rowsOf,
	score,
	trainBrier,
	type FitOptions,
	type Mapping,
	type Scores
} from './metrics.ts';
import type { EpaParams, Model, OprParams } from './models.ts';
import { attach } from './lab/robot/data.ts';
import { prepSeason, type PEvent } from './prep.ts';
import { productionRecords } from './production.ts';

const TRAIN = [2021, 2022, 2023, 2024, 2025];
const VALID = [2024, 2025];
const TEST = [2026];
const ALL = [...new Set([...TRAIN, ...VALID, ...TEST])].sort((a, b) => a - b);
const GAMES: Record<number, string> = {
	2021: 'Freight Frenzy',
	2022: 'POWERPLAY',
	2023: 'CENTERSTAGE',
	2024: 'INTO THE DEEP',
	2025: 'DECODE',
	2026: 'BIOBUZZ'
};
const ENGINE = { halfLife: Infinity, warmup: 30 };
const TUNE_FIT: FitOptions = { links: ['logit'], etas: [0.05, 0.1, 0.2], gammas: [0.25] };
const FULL_FIT: FitOptions = {
	links: ['probit', 'logit'],
	etas: [0, 0.025, 0.05, 0.1, 0.15, 0.2, 0.3],
	gammas: [0, 0.125, 0.25, 0.375, 0.5]
};
const BLEND_WEIGHTS = [0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 0.95, 1];
const PARAMS_PATH = join(import.meta.dirname, 'params.json');
const OUT_PATH = join(import.meta.dirname, '..', '..', 'src', 'lib', 'model', 'accuracy.json');

type Stored = {
	candidates: Record<string, Params>;
	blend?: { opr: string; epa: string; w: number };
};

const round = (x: number, digits = 5) => Number(x.toFixed(digits));

async function loadSeasons(seasons: number[]): Promise<PEvent[][]> {
	const out: PEvent[][] = [];
	for (const s of seasons) out.push(prepSeason(await loadSeason(s)));
	attach(out);
	return out;
}

function objective(seasons: PEvent[][], models: Model[]): number[] {
	const rec = run(seasons, models, ENGINE);
	const rows = rowsOf(rec, () => true);
	return models.map((_, k) => trainBrier(rec, k, rows, TUNE_FIT));
}

function maeObjective(seasons: PEvent[][], models: Model[]): number[] {
	const rec = run(seasons, models, ENGINE);
	const map: Mapping = { link: 'logit', kappa: 1, eta: 0, gamma: 0 };
	return models.map((_, k) => score(rec, k, map, () => true).mae);
}

function search(
	c: Candidate,
	start: Record<string, unknown>,
	space: Record<string, number[]>,
	loss: (models: Model[]) => number[],
	label: string
): Record<string, unknown> {
	let best = { ...start };
	let bestLoss = loss([build(c, best as OprParams)])[0];
	console.log(`tune ${c.id} ${label}: start ${bestLoss.toFixed(5)}`);
	for (let pass = 0; pass < 3; pass++) {
		let improved = false;
		for (const [key, values] of Object.entries(space)) {
			const options = values.map((v) => ({ ...best, [key]: v }));
			const losses = loss(options.map((o) => build(c, o as OprParams)));
			const i = losses.indexOf(Math.min(...losses));
			console.log(`  ${key}: ${values.map((v, j) => `${v}=${losses[j].toFixed(5)}`).join(' ')}`);
			if (losses[i] < bestLoss - 1e-7) {
				bestLoss = losses[i];
				best = options[i];
				improved = true;
			}
		}
		console.log(`  pass ${pass}: ${bestLoss.toFixed(5)}`);
		if (!improved) break;
	}
	return best;
}

function tune(
	c: Candidate,
	train: PEvent[][],
	start: OprParams | EpaParams
): OprParams | EpaParams {
	let best = search(c, { ...start }, c.space, (models) => objective(train, models), 'brier');
	if (c.scoreSpace)
		best = search(c, best, c.scoreSpace, (models) => maeObjective(train, models), 'mae');
	return resolve(c, best as OprParams);
}

function tuneBlend(train: PEvent[][], stored: Stored, oprId: string, epaId: string): number {
	const opr = CANDIDATES.find((c) => c.id === oprId)!;
	const epa = CANDIDATES.find((c) => c.id === epaId)!;
	const models = BLEND_WEIGHTS.map((w) =>
		blend(
			`blend-${w}`,
			build(opr, stored.candidates[oprId]),
			build(epa, stored.candidates[epaId]),
			w
		)
	);
	const losses = objective(train, models);
	console.log(
		`blend ${oprId}+${epaId}: ${BLEND_WEIGHTS.map((w, i) => `${w}=${losses[i].toFixed(5)}`).join(' ')}`
	);
	return BLEND_WEIGHTS[losses.indexOf(Math.min(...losses))];
}

function seasonFilter(rec: Records, seasons: number[]) {
	const set = new Set(seasons);
	return (r: number) => set.has(rec.season[r]);
}

function metricsOf(s: Scores) {
	return {
		brier: round(s.brier),
		logloss: round(s.logloss),
		accuracy: round(s.accuracy, 4),
		mae: round(s.mae, 2)
	};
}

function table(title: string, rows: [string, Scores][]): void {
	console.log(`\n${title}`);
	console.log(
		'model'.padEnd(18),
		'n'.padStart(7),
		'brier'.padStart(8),
		'logloss'.padStart(8),
		'acc'.padStart(7),
		'mae'.padStart(7)
	);
	for (const [name, s] of rows) {
		console.log(
			name.padEnd(18),
			String(s.n).padStart(7),
			s.brier.toFixed(4).padStart(8),
			s.logloss.toFixed(4).padStart(8),
			(s.accuracy * 100).toFixed(1).padStart(7),
			s.mae.toFixed(2).padStart(7)
		);
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const tuneAll = args.includes('--tune');
	const tuneOnly = args
		.find((a) => a.startsWith('--tune='))
		?.slice(7)
		.split(',');
	const stored: Stored = JSON.parse(
		await readFile(PARAMS_PATH, 'utf8').catch(() => '{"candidates":{}}')
	);
	const train = await loadSeasons(TRAIN);

	for (const c of CANDIDATES) {
		if (c.family === 'robot') {
			stored.candidates[c.id] = OPR_PARAMS;
			continue;
		}
		const wanted = tuneAll || tuneOnly?.includes(c.id) || !stored.candidates[c.id];
		if (wanted)
			stored.candidates[c.id] = tune(
				c,
				train,
				(stored.candidates[c.id] ?? c.base) as OprParams | EpaParams
			);
	}

	const trainLoss = (id: string) =>
		objective(train, [
			build(
				CANDIDATES.find((c) => c.id === id)!,
				stored.candidates[id]
			)
		])[0];
	if (tuneAll || tuneOnly || !stored.blend) {
		const oprIds = CANDIDATES.filter((c) => c.family === 'opr').map((c) => c.id);
		const epaIds = CANDIDATES.filter((c) => c.family === 'epa').map((c) => c.id);
		const bestOf = (ids: string[]) =>
			ids.map((id) => [id, trainLoss(id)] as const).sort((a, b) => a[1] - b[1])[0][0];
		const opr = bestOf(oprIds);
		const epa = bestOf(epaIds);
		stored.blend = { opr, epa, w: tuneBlend(train, stored, opr, epa) };
	}
	await writeFile(PARAMS_PATH, `${JSON.stringify(stored, null, '\t')}\n`);

	const seasons = [...train, ...(await loadSeasons(ALL.filter((s) => !TRAIN.includes(s))))];
	const models: Model[] = CANDIDATES.map((c) => build(c, stored.candidates[c.id]));
	const b = stored.blend!;
	const oprC = CANDIDATES.find((c) => c.id === b.opr)!;
	const epaC = CANDIDATES.find((c) => c.id === b.epa)!;
	if (b.w < 1)
		models.push(
			blend(
				'blend',
				build(oprC, stored.candidates[b.opr]),
				build(epaC, stored.candidates[b.epa]),
				b.w
			)
		);
	const ids = models.map((m) => m.name);
	const labels: Record<string, string> = Object.fromEntries(CANDIDATES.map((c) => [c.id, c.label]));
	labels.blend = `Blend: ${Math.round(b.w * 100)}% ${b.opr} + ${Math.round((1 - b.w) * 100)}% ${b.epa}`;

	const t0 = Date.now();
	const rec = run(seasons, models, ENGINE);
	console.log(`evaluated ${rec.n} matches x ${models.length} models in ${Date.now() - t0} ms`);

	const trainRows = rowsOf(rec, seasonFilter(rec, TRAIN));
	const maps: Mapping[] = models.map((_, k) => fitMapping(rec, k, trainRows, FULL_FIT));
	const inValid = seasonFilter(rec, VALID);
	const inTest = seasonFilter(rec, TEST);
	const inTrain = seasonFilter(rec, TRAIN);
	const pooled = (filter: (r: number) => boolean) =>
		models.map((_, k) => score(rec, k, maps[k], filter));

	const validScores = pooled(inValid);
	const chosenIndex = validScores.reduce(
		(best, s, k) => (s.brier < validScores[best].brier ? k : best),
		0
	);
	const chosen = ids[chosenIndex];

	const familyOf = (id: string) => CANDIDATES.find((c) => c.id === id)?.family ?? 'blend';
	const chosenFamily = familyOf(chosen) === 'blend' ? 'opr' : familyOf(chosen);
	const rivals = ids
		.map((id, k) => [k, familyOf(id)] as const)
		.filter(([, f]) => f !== 'blend' && f !== chosenFamily)
		.map(([k]) => k)
		.sort((a, b) => validScores[a].brier - validScores[b].brier);
	const runnerUp = rivals[0];
	const gap = pairedGap(rec, chosenIndex, runnerUp, maps[chosenIndex], maps[runnerUp], inValid);
	console.log(
		`validation Brier gap ${ids[chosenIndex]} vs ${ids[runnerUp]}: ${gap.diff.toFixed(5)} +/- ${gap.se.toFixed(5)}`
	);

	const previousIndex = ids.indexOf('opr-map');
	const testGap = pairedGap(
		rec,
		chosenIndex,
		previousIndex,
		maps[chosenIndex],
		maps[previousIndex],
		inTest
	);
	console.log(
		`test Brier gap ${ids[chosenIndex]} vs opr-map: ${testGap.diff.toFixed(5)} +/- ${testGap.se.toFixed(5)}`
	);

	table(
		'train 2021-2025',
		pooled(inTrain).map((s, k) => [ids[k], s])
	);
	table(
		'validation 2024-2025',
		validScores.map((s, k) => [ids[k], s])
	);
	table(
		'test 2026',
		pooled(inTest).map((s, k) => [ids[k], s])
	);
	console.log(`\nchosen on validation Brier: ${chosen}`);

	const groups: Record<string, (r: number) => boolean> = {
		qual: (r) => rec.playoff[r] === 0,
		playoff: (r) => rec.playoff[r] === 1,
		early: (r) => rec.early[r] === 1,
		late: (r) => rec.early[r] === 0,
		official: (r) => rec.official[r] === 1,
		other: (r) => rec.official[r] === 0
	};
	const perModel = (filter: (r: number) => boolean) => {
		const out: Record<string, ReturnType<typeof metricsOf>> = {};
		let n = 0;
		models.forEach((_, k) => {
			const s = score(rec, k, maps[k], filter);
			n = s.n;
			out[ids[k]] = metricsOf(s);
		});
		return { n, models: out };
	};
	const seasonRows = ALL.map((season) => {
		const inSeason = (r: number) => rec.season[r] === season;
		const all = perModel(inSeason);
		const breakdown = Object.fromEntries(
			Object.entries(groups).map(([name, g]) => [name, perModel((r) => inSeason(r) && g(r))])
		);
		const split = VALID.includes(season) ? 'validation' : TRAIN.includes(season) ? 'train' : 'test';
		return { season, game: GAMES[season], split, n: all.n, models: all.models, breakdown };
	});
	for (const row of seasonRows) {
		table(
			`${row.season} ${row.game} (${row.split})`,
			ids.map((id) => [id, { n: row.n, ...row.models[id] }])
		);
	}

	const calib = (filter: (r: number) => boolean) =>
		calibration(rec, chosenIndex, maps[chosenIndex], filter).map((bin) => ({
			lo: bin.lo,
			hi: bin.hi,
			n: bin.n,
			predicted: round(bin.predicted, 4),
			observed: round(bin.observed, 4)
		}));
	let production: { brier: number; mae: number; maxDiff: number } | null = null;
	const chosenCandidate = CANDIDATES.find((c) => c.id === chosen);
	if (chosenCandidate?.family === 'robot') {
		const prod = productionRecords(rec, seasons, chosen);
		const all = (r: number) => r >= 0;
		const a = score(rec, chosenIndex, maps[chosenIndex], all);
		const p = score(prod, 0, maps[chosenIndex], all);
		let maxDiff = 0;
		const M = models.length;
		for (let r = 0; r < rec.n; r++) {
			for (let j = 0; j < 5; j++)
				maxDiff = Math.max(
					maxDiff,
					Math.abs(rec.pred[(r * M + chosenIndex) * 5 + j] - prod.pred[r * 5 + j])
				);
		}
		production = { brier: round(p.brier - a.brier, 9), mae: round(p.mae - a.mae, 9), maxDiff };
		console.log(
			`production code check: brier diff ${production.brier}, mae diff ${production.mae}, max prediction diff ${maxDiff}`
		);
	}
	const existing = JSON.parse(await readFile(OUT_PATH, 'utf8').catch(() => '{}'));
	const result = {
		generatedAt: new Date().toISOString(),
		method: {
			train: TRAIN,
			validation: VALID,
			test: TEST,
			primary: 'brier',
			note: 'Every match is predicted from data before it. Ties count as half a win in Brier and log loss and are left out of accuracy. MAE is on alliance score without penalties.'
		},
		chosen: {
			id: chosen,
			label: labels[chosen],
			params:
				chosen === 'blend'
					? { ...b, opr: stored.candidates[b.opr], epa: stored.candidates[b.epa] }
					: stored.candidates[chosen],
			mapping: { ...maps[chosenIndex], kappa: round(maps[chosenIndex].kappa, 5) }
		},
		models: ids.map((id, k) => ({
			id,
			label: labels[id],
			mapping: { ...maps[k], kappa: round(maps[k].kappa, 5) }
		})),
		pooled: {
			train: Object.fromEntries(
				pooled(inTrain).map((s, k) => [ids[k], { n: s.n, ...metricsOf(s) }])
			),
			validation: Object.fromEntries(
				validScores.map((s, k) => [ids[k], { n: s.n, ...metricsOf(s) }])
			),
			test: Object.fromEntries(pooled(inTest).map((s, k) => [ids[k], { n: s.n, ...metricsOf(s) }]))
		},
		seasons: seasonRows,
		calibration: { model: chosen, validation: calib(inValid), test: calib(inTest) },
		validationGap: { against: ids[runnerUp], diff: round(gap.diff), se: round(gap.se) },
		testGap: { against: 'opr-map', diff: round(testGap.diff), se: round(testGap.se) },
		productionCheck: production,
		rp: existing.rp ?? null,
		schedule: existing.schedule ?? null
	};
	await writeFile(OUT_PATH, `${JSON.stringify(result)}\n`);
	console.log(`wrote ${OUT_PATH}`);
}

await main();
