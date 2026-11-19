import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { orderEvents, orderMatches, rateSeason, type Forecast } from '../../src/lib/model/opr.ts';
import { marginScale, WIN_PARAMS } from '../../src/lib/model/predict.ts';
import { RP_RULES, SwarmBook, swarmFromMean, tipChances } from '../../src/lib/model/rp.ts';
import type { ModelEvent, ModelMatch } from '../../src/lib/model/types.ts';
import { loadSeason } from './hist.ts';
import { prepSeason } from './prep.ts';
import { toModelEvent } from './production.ts';

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

type Row = {
	match: ModelMatch;
	forecast: Forecast;
	swarm: Record<string, { red: number; blue: number }>;
};

function collect(
	events: ModelEvent[],
	previous: Map<number, number>,
	books: Record<string, SwarmBook>
): Row[] {
	const forecasts = new Map<string, Forecast>();
	rateSeason(events, { previous, onForecast: (_e, m, f) => forecasts.set(m.key, f) });
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
	const prior = rateSeason(prepSeason(await loadSeason(2025)).map(toModelEvent));
	const events = prepSeason(await loadSeason(2026)).map(toModelEvent);
	const settings: Record<string, { prior: number; carry: number }> = {};
	for (const p of [1, 1.5, 2, 3, 5])
		for (const c of [0, 0.1, 0.2, 0.3, 0.4, 0.6]) settings[`${p}/${c}`] = { prior: p, carry: c };
	const books = Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, new SwarmBook(v)]));
	const rows = collect(events, prior.relative, books).filter((r) => r.match.level === 'qual');
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
	const swarmChoice = bestRobot.brier <= normal[0].brier ? 'robots' : 'normal';
	console.log(
		'swarm robots best',
		JSON.stringify(bestRobot),
		'normal best',
		JSON.stringify(normal[0]),
		'->',
		swarmChoice
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

	const robotKey = bestRobot.key;
	const swarmSamples =
		swarmChoice === 'robots'
			? sides.map((s) => ({ p: s.row.swarm[robotKey][s.own], y: swarmHit(s.detail) }))
			: sides.map((s) => ({
					p: swarmFromMean(s.f.components.leave + s.f.components.park, normal[0].sd),
					y: swarmHit(s.detail)
				}));
	const p1Samples = sides.map((s) => ({
		p: tipChances(s.f.components.tips, RP_RULES, { size: tip.size }).pollinator1,
		y: (s.detail.tips ?? 0) >= RP_RULES.pollinator1 ? 1 : 0
	}));
	const p2Samples = sides.map((s) => ({
		p: tipChances(s.f.components.tips, RP_RULES, { size: tip.size }).pollinator2,
		y: (s.detail.tips ?? 0) >= RP_RULES.pollinator2 ? 1 : 0
	}));
	const result = {
		season: 2026,
		alliances: sides.length,
		swarm: {
			model: swarmChoice,
			params: swarmChoice === 'robots' ? settings[robotKey] : { sd: normal[0].sd },
			alternative:
				swarmChoice === 'robots'
					? { model: 'normal', sd: normal[0].sd, brier: normal[0].brier }
					: { model: 'robots', ...settings[robotKey], brier: bestRobot.brier },
			...scores(swarmSamples),
			calibration: bins(swarmSamples)
		},
		tips: {
			model: Number.isFinite(tip.size) ? 'negative binomial' : 'poisson',
			size: Number.isFinite(tip.size) ? tip.size : null
		},
		pollinator1: { ...scores(p1Samples), calibration: bins(p1Samples) },
		pollinator2: { ...scores(p2Samples), calibration: bins(p2Samples) },
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
