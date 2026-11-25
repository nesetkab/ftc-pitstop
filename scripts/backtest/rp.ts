import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	orderEvents,
	orderMatches,
	rateSeason,
	type Forecast,
	type PriorRel,
	type RobotBase
} from '../../src/lib/model/opr.ts';
import { marginScale, WIN_PARAMS } from '../../src/lib/model/predict.ts';
import {
	calibratedSwarm,
	logit,
	recalibrate,
	RP_CALIBRATION,
	RP_RULES,
	SWARM_MODEL,
	SwarmBook,
	swarmFromMean,
	tipChances,
	type Platt,
	type SwarmCalibration
} from '../../src/lib/model/rp.ts';
import type { ModelEvent, ModelMatch } from '../../src/lib/model/types.ts';
import { loadSeason } from './hist.ts';
import { prepSeason } from './prep.ts';
import { previousFor, toModelEvent } from './production.ts';

const OUT_PATH = join(import.meta.dirname, '..', '..', 'src', 'lib', 'model', 'accuracy.json');
const round = (x: number, d = 4) => Number(x.toFixed(d));

type Sample = { p: number; y: number };

function scores(samples: Sample[]) {
	let brier = 0;
	let logloss = 0;
	let base = 0;
	for (const { p, y } of samples) {
		const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
		brier += (p - y) ** 2;
		logloss -= y * Math.log(q) + (1 - y) * Math.log(1 - q);
		base += y;
	}
	const n = samples.length;
	const rate = base / n;
	const climate = rate * (1 - rate);
	return {
		n,
		brier: round(brier / n),
		logloss: round(logloss / n),
		rate: round(rate),
		skill: round(1 - brier / n / climate)
	};
}

function bins(samples: Sample[], count = 10) {
	const out = Array.from({ length: count }, (_, i) => ({
		lo: i / count,
		hi: (i + 1) / count,
		n: 0,
		predicted: 0,
		observed: 0
	}));
	for (const { p, y } of samples) {
		const b = out[Math.min(count - 1, Math.floor(p * count))];
		b.n++;
		b.predicted += p;
		b.observed += y;
	}
	return out
		.filter((b) => b.n > 0)
		.map((b) => ({ ...b, predicted: round(b.predicted / b.n), observed: round(b.observed / b.n) }));
}

function solve(A: number[][], b: number[]): number[] {
	const n = b.length;
	const M = A.map((row, i) => [...row, b[i]]);
	for (let c = 0; c < n; c++) {
		let p = c;
		for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
		[M[c], M[p]] = [M[p], M[c]];
		for (let r = 0; r < n; r++) {
			if (r === c) continue;
			const f = M[r][c] / M[c][c];
			for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
		}
	}
	return M.map((row, i) => row[n] / row[i]);
}

function fitLogistic(xs: number[][], ys: number[]): number[] {
	const k = xs[0].length + 1;
	const w = [0, ...Array.from({ length: k - 1 }, () => 1 / (k - 1))];
	for (let iter = 0; iter < 50; iter++) {
		const g = new Array(k).fill(0);
		const H = Array.from({ length: k }, () => new Array(k).fill(0));
		xs.forEach((x, i) => {
			const z = [1, ...x];
			const p = 1 / (1 + Math.exp(-z.reduce((sum, v, j) => sum + v * w[j], 0)));
			for (let a = 0; a < k; a++) {
				g[a] += (p - ys[i]) * z[a];
				for (let b = 0; b < k; b++) H[a][b] += p * (1 - p) * z[a] * z[b];
			}
		});
		const step = solve(H, g);
		for (let a = 0; a < k; a++) w[a] -= step[a];
		if (step.reduce((sum, v) => sum + Math.abs(v), 0) < 1e-10) break;
	}
	return w;
}

function fitPlatt(samples: Sample[]): Platt {
	const [a, b] = fitLogistic(
		samples.map(({ p }) => [logit(p)]),
		samples.map(({ y }) => y)
	);
	return { a: round(a, 4), b: round(b, 4) };
}

type SwarmSample = { robots: number; points: number; y: number };

function fitSwarm(samples: SwarmSample[], sd: number): SwarmCalibration {
	const [a, robots, points] = fitLogistic(
		samples.map((s) => [logit(s.robots), logit(swarmFromMean(s.points, sd))]),
		samples.map((s) => s.y)
	);
	return { a: round(a, 4), robots: round(robots, 4), points: round(points, 4), sd };
}

function stacked(samples: SwarmSample[], c: SwarmCalibration): Sample[] {
	return samples.map((s) => ({
		p: calibratedSwarm(s.robots, s.points, { ...RP_CALIBRATION, swarm: c }),
		y: s.y
	}));
}

function calibrated(samples: Sample[], c: Platt): Sample[] {
	return samples.map(({ p, y }) => ({ p: recalibrate(p, c), y }));
}

type Row = {
	match: ModelMatch;
	forecast: Forecast;
	swarm: Record<string, { red: number; blue: number }>;
};

function collect(
	events: ModelEvent[],
	previous: Map<number, PriorRel>,
	base: RobotBase,
	books: Record<string, SwarmBook>
): Row[] {
	const forecasts = new Map<string, Forecast>();
	rateSeason(events, { previous, base, onForecast: (_e, m, f) => forecasts.set(m.key, f) });
	const rows: Row[] = [];
	for (const event of orderEvents(events)) {
		const matches = orderMatches(event.matches);
		const teams = [...new Set(matches.flatMap((m) => [...m.red, ...m.blue]))];
		for (const book of Object.values(books)) book.enterEvent(event.code, teams);
		for (const match of matches) {
			const forecast = forecasts.get(match.key);
			if (!forecast) continue;
			const swarm: Row['swarm'] = {};
			for (const [name, book] of Object.entries(books)) {
				swarm[name] = { red: book.chance(match.red), blue: book.chance(match.blue) };
				book.update(match);
			}
			rows.push({ match, forecast, swarm });
		}
	}
	return rows;
}

async function main(): Promise<void> {
	const { previous, base } = await previousFor(2026);
	const events = prepSeason(await loadSeason(2026)).map(toModelEvent);
	const settings: Record<string, { prior: number; carry: number }> = {};
	for (const p of [1, 1.5, 2, 3, 5])
		for (const c of [0, 0.1, 0.2, 0.3, 0.4, 0.6]) settings[`${p}/${c}`] = { prior: p, carry: c };
	const books = Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, new SwarmBook(v)]));
	const rows = collect(events, previous, base, books).filter((r) => r.match.level === 'qual');
	const sides = rows.flatMap((r) =>
		(['red', 'blue'] as const).map((own) => ({
			row: r,
			own,
			detail: own === 'red' ? r.match.redDetail! : r.match.blueDetail!,
			f: r.forecast[own]
		}))
	);
	const swarmHit = (d: (typeof sides)[number]['detail']) =>
		(d.leavePoints ?? 0) + (d.parkPoints ?? 0) >= RP_RULES.swarm ? 1 : 0;

	const robot = Object.keys(settings).map((k) => ({
		key: k,
		...scores(sides.map((s) => ({ p: s.row.swarm[k][s.own], y: swarmHit(s.detail) })))
	}));
	robot.sort((a, b) => a.brier - b.brier);
	const bestRobot = robot[0];
	const normal = [4, 6, 8, 10, 12, 15].map((sd) => ({
		sd,
		...scores(
			sides.map((s) => ({
				p: swarmFromMean(s.f.components.leave + s.f.components.park, sd),
				y: swarmHit(s.detail)
			}))
		)
	}));
	normal.sort((a, b) => a.brier - b.brier);
	console.log(
		'swarm robots best',
		JSON.stringify(bestRobot),
		'normal best',
		JSON.stringify(normal[0])
	);

	const tipModels = [1, 2, 3, 5, 8, 16, Infinity].map((size) => {
		const p1 = sides.map((s) => ({
			p: tipChances(s.f.components.tips, RP_RULES, { size }).pollinator1,
			y: (s.detail.tips ?? 0) >= RP_RULES.pollinator1 ? 1 : 0
		}));
		const p2 = sides.map((s) => ({
			p: tipChances(s.f.components.tips, RP_RULES, { size }).pollinator2,
			y: (s.detail.tips ?? 0) >= RP_RULES.pollinator2 ? 1 : 0
		}));
		const a = scores(p1);
		const b = scores(p2);
		return { size, p1: a, p2: b, loss: a.logloss + b.logloss };
	});
	tipModels.sort((a, b) => a.loss - b.loss);
	const tip = tipModels[0];
	console.log(
		'tips',
		tipModels.map((t) => `${t.size}: ${t.p1.logloss}/${t.p2.logloss}`).join(' | ')
	);

	let ties = 0;
	let weight = 0;
	let sq = 0;
	let count = 0;
	for (const r of rows) {
		const { forecast: f, match: m } = r;
		const z = (f.red.strength - f.blue.strength) / marginScale(f, WIN_PARAMS);
		weight += Math.exp(-0.5 * z * z);
		if (m.redScore === m.blueScore) ties++;
		for (const own of ['red', 'blue'] as const) {
			const y = own === 'red' ? m.redNp! : m.blueNp!;
			sq += (y - f[own].score) ** 2 / (f.stats.sd ** 2 * f[own].variance);
			count++;
		}
	}
	const tie = ties / weight;
	const scoreSigma = Math.sqrt(sq / count);
	console.log('tie scale', tie.toFixed(4), 'score sigma', scoreSigma.toFixed(4));

	const robotKey = `${SWARM_MODEL.prior}/${SWARM_MODEL.carry}`;
	const swarmSamples: SwarmSample[] = sides.map((s) => ({
		robots: s.row.swarm[robotKey][s.own],
		points: s.f.components.leave + s.f.components.park,
		y: swarmHit(s.detail)
	}));
	const robotsOnly = swarmSamples.map(({ robots, y }) => ({ p: robots, y }));
	const swarmSd = normal[0].sd;
	const p1Samples = sides.map((s) => ({
		p: tipChances(s.f.components.tips, RP_RULES, { size: tip.size }).pollinator1,
		y: (s.detail.tips ?? 0) >= RP_RULES.pollinator1 ? 1 : 0
	}));
	const p2Samples = sides.map((s) => ({
		p: tipChances(s.f.components.tips, RP_RULES, { size: tip.size }).pollinator2,
		y: (s.detail.tips ?? 0) >= RP_RULES.pollinator2 ? 1 : 0
	}));
	const split = '2026-11-08';
	const starts = new Map(events.map((e) => [e.code, e.start]));
	const early = sides.map((s) => (starts.get(s.row.match.eventCode) ?? '') < split);
	const holdout = (samples: Sample[]) => {
		const fit = fitPlatt(samples.filter((_, i) => early[i]));
		const later = samples.filter((_, i) => !early[i]);
		return {
			fitOn: `events before ${split}`,
			n: later.length,
			raw: scores(later).brier,
			calibrated: scores(calibrated(later, fit)).brier
		};
	};
	const swarmHoldout = (() => {
		const fit = fitSwarm(
			swarmSamples.filter((_, i) => early[i]),
			swarmSd
		);
		const platt = fitPlatt(robotsOnly.filter((_, i) => early[i]));
		const later = swarmSamples.filter((_, i) => !early[i]);
		const laterRobots = robotsOnly.filter((_, i) => !early[i]);
		return {
			fitOn: `events before ${split}`,
			n: later.length,
			raw: scores(laterRobots).brier,
			robotsOnly: scores(calibrated(laterRobots, platt)).brier,
			calibrated: scores(stacked(later, fit)).brier
		};
	})();
	const fits = {
		swarm: fitSwarm(swarmSamples, swarmSd),
		pollinator1: fitPlatt(p1Samples),
		pollinator2: fitPlatt(p2Samples)
	};
	console.log('platt', JSON.stringify(fits), 'shipped', JSON.stringify(RP_CALIBRATION));
	const pack = (samples: Sample[], c: Platt) => ({
		raw: scores(samples),
		...scores(calibrated(samples, c)),
		platt: c,
		holdout: holdout(samples),
		calibration: bins(calibrated(samples, c))
	});
	const result = {
		season: 2026,
		alliances: sides.length,
		swarm: {
			model: 'robots and points',
			params: settings[robotKey],
			alternative: { model: 'normal', sd: normal[0].sd, brier: normal[0].brier },
			raw: scores(robotsOnly),
			...scores(stacked(swarmSamples, RP_CALIBRATION.swarm)),
			stack: RP_CALIBRATION.swarm,
			holdout: swarmHoldout,
			calibration: bins(stacked(swarmSamples, RP_CALIBRATION.swarm))
		},
		tips: {
			model: Number.isFinite(tip.size) ? 'negative binomial' : 'poisson',
			size: Number.isFinite(tip.size) ? tip.size : null
		},
		pollinator1: pack(p1Samples, RP_CALIBRATION.pollinator1),
		pollinator2: pack(p2Samples, RP_CALIBRATION.pollinator2),
		tie: round(tie),
		scoreSigma: round(scoreSigma)
	};
	console.log(
		JSON.stringify({
			...result,
			swarm: { ...result.swarm, calibration: undefined },
			pollinator1: { ...result.pollinator1, calibration: undefined },
			pollinator2: { ...result.pollinator2, calibration: undefined }
		})
	);
	const existing = JSON.parse(await readFile(OUT_PATH, 'utf8').catch(() => '{}'));
	await writeFile(OUT_PATH, `${JSON.stringify({ ...existing, rp: result })}\n`);
}

await main();
