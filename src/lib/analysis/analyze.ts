import { playingTeams, toModelEvent } from '#lib/analysis/convert.ts';
import type {
	AllianceForecast,
	AllianceOdds,
	AnalysisContext,
	EventAnalysis,
	EventTiming,
	MatchForecast,
	MatchTiming,
	PickAnalysis,
	Projection,
	RatingParts,
	ScheduleStrength,
	TeamRating
} from '#lib/analysis/types.ts';
import {
	allianceCountFor,
	analyzePicks,
	bracketFor,
	resolveBracket,
	simulateBracket,
	type AllianceCount,
	type BracketState,
	type Color,
	type Source
} from '#lib/model/bracket.ts';
import {
	COMPONENTS,
	dayNumber,
	OPR_PARAMS,
	priorFor,
	rateSeason,
	SCORE_SIGMA,
	type Priors,
	type Track
} from '#lib/model/opr.ts';
import {
	predictMatch,
	redChance,
	type AlliancePrediction,
	type MatchPrediction
} from '#lib/model/predict.ts';
import { SwarmBook } from '#lib/model/rp.ts';
import {
	estimateStarts,
	observedCycle,
	PLAYOFF_SCHEDULE,
	scheduledCycle,
	type ScheduleOptions,
	type TimedMatch
} from '#lib/model/schedule.ts';
import { simulateRankings, tallyResults, type SimMatch, type Tally } from '#lib/model/simulate.ts';
import { scheduleStrength } from '#lib/model/sos.ts';
import { isPlayed, type ModelMatch } from '#lib/model/types.ts';
import type { AllianceSelection, EventBundle, Match, Ranking } from '#lib/types.ts';

export const MODEL = { id: 'opr-map', label: 'OPR' };

export type AnalyzeOptions = { now: number; sims?: number; pickSims?: number; seed?: number };

type WinProb = (red: number, blue: number) => number;

function round(value: number, digits: number): number {
	const factor = 10 ** digits;
	const rounded = Math.round(value * factor) / factor;
	return Number.isFinite(rounded) ? rounded || 0 : 0;
}

const points = (value: number) => round(value, 2);
const chance = (value: number) => round(value, 4);

function trackIndex(track: Track): number {
	if (track === 'strength') return 0;
	if (track === 'opr') return 1;
	return COMPONENTS.indexOf(track) + 2;
}

function numberMap<T>(record: Record<number, T>): Map<number, T> {
	return new Map(Object.entries(record).map(([key, value]) => [Number(key), value]));
}

function allianceForecast(side: AlliancePrediction, win: number): AllianceForecast {
	return {
		score: points(side.score),
		sd: points(side.sd),
		win: chance(win),
		rp: {
			win: chance(side.rp.win),
			tie: chance(side.rp.tie),
			swarm: chance(side.rp.swarm),
			pollinator1: chance(side.rp.pollinator1),
			pollinator2: chance(side.rp.pollinator2),
			expected: points(side.rp.expected)
		}
	};
}

export function matchForecast(
	key: string,
	prediction: MatchPrediction,
	played: boolean,
	winner: Color | null
): MatchForecast {
	const { redWin, blueWin } = prediction;
	const pick = redWin > blueWin ? 'red' : blueWin > redWin ? 'blue' : null;
	return {
		key,
		red: allianceForecast(prediction.red, redWin),
		blue: allianceForecast(prediction.blue, blueWin),
		tie: chance(prediction.tie),
		played,
		correct: played && winner && pick ? pick === winner : null
	};
}

function simMatch(match: ModelMatch, p: MatchPrediction): SimMatch {
	return {
		red: match.red,
		blue: match.blue,
		surrogates: match.surrogates,
		redWin: p.redWin,
		blueWin: p.blueWin,
		tie: p.tie,
		redScore: p.red.np,
		blueScore: p.blue.np,
		redSd: p.red.sd,
		blueSd: p.blue.sd,
		redTips: p.red.components.tips,
		blueTips: p.blue.components.tips,
		redPollinator1: p.red.rp.pollinator1,
		redPollinator2: p.red.rp.pollinator2,
		bluePollinator1: p.blue.rp.pollinator1,
		bluePollinator2: p.blue.rp.pollinator2,
		redSwarm: p.red.rp.swarm,
		blueSwarm: p.blue.rp.swarm,
		redAuto: p.red.components.auto,
		blueAuto: p.blue.components.auto
	};
}

function currentTally(quals: ModelMatch[], rankings: Ranking[]): Tally[] {
	const detailed = quals.every(
		(m) => !isPlayed(m) || (m.redDetail?.tips !== undefined && m.blueDetail?.tips !== undefined)
	);
	if (detailed || rankings.length === 0) return tallyResults(quals);
	return rankings.map((r) => ({
		team: r.team,
		rp: r.rs * r.played,
		np: r.tbp * r.played,
		tips: r.avgTips * r.played,
		auto: r.avgAuto * r.played,
		counted: r.played
	}));
}

function timedMatches(list: Match[]): TimedMatch[] {
	return list.map((m) => ({
		key: m.key,
		scheduled: m.scheduledTime,
		actual: m.actualTime ?? (m.result ? (m.postedTime ?? m.scheduledTime) : null)
	}));
}

function cycleOf(timed: TimedMatch[], options: ScheduleOptions): number | null {
	let last = -1;
	for (let i = 0; i < timed.length; i++) if (timed[i].actual !== null) last = i;
	return observedCycle(timed.slice(0, last + 1), options) ?? scheduledCycle(timed);
}

function eventTiming(bundle: EventBundle, now: number): EventTiming {
	const quals = bundle.matches
		.filter((m) => m.level === 'qual')
		.sort((a, b) => a.number - b.number);
	const playoffs = bundle.matches
		.filter((m) => m.level === 'playoff')
		.sort(
			(a, b) =>
				(a.scheduledTime ?? Infinity) - (b.scheduledTime ?? Infinity) ||
				a.series - b.series ||
				a.number - b.number
		);
	const groups: [Match[], ScheduleOptions][] = [
		[quals, { now }],
		[playoffs, { ...PLAYOFF_SCHEDULE, now }]
	];
	const matches: Record<string, MatchTiming> = {};
	let unfinished = 0;
	let onField: string | null = null;
	let next: string | null = null;
	let delay: number | null = null;
	let cycle: number | null = null;
	let active = false;
	for (const [list, options] of groups) {
		if (list.length === 0) continue;
		const timed = timedMatches(list);
		const estimates = estimateStarts(timed, options);
		let frontier = -1;
		for (let i = 0; i < timed.length; i++) if (timed[i].actual !== null) frontier = i;
		for (let i = 0; i < list.length; i++) {
			const m = list[i];
			const estimate = estimates[i];
			const done = m.result !== null;
			const started = done || m.actualTime !== null;
			const held = !started && i < frontier;
			if (!done && m.actualTime !== null) onField = m.key;
			if (!started && !held && next === null) {
				next = m.key;
				delay = m.scheduledTime === null ? null : estimate.start - m.scheduledTime;
			}
			matches[m.key] = {
				key: m.key,
				scheduled: m.scheduledTime,
				expectedStart: started ? timed[i].actual : held ? null : Math.round(estimate.start),
				queueAt: started || held ? null : Math.round(estimate.queue),
				matchesAway: done || held ? null : unfinished
			};
			if (!done && !held) unfinished++;
		}
		if (!active) {
			cycle = cycleOf(timed, options);
			active = list.some((m) => m.result === null);
		}
	}
	return {
		cycleSeconds: cycle === null ? null : Math.round(cycle / 1000),
		delaySeconds: delay === null ? null : Math.round(delay / 1000),
		onField,
		next,
		matches
	};
}

function allianceSize(count: number): AllianceCount | null {
	return count === 2 || count === 4 || count === 6 || count === 8 ? count : null;
}

function bracketNumber(match: Match, size: AllianceCount): number {
	return size === 2 ? match.number : match.series;
}

function members(alliance: AllianceSelection): number[] {
	const teams = [alliance.captain, ...alliance.picks];
	if (alliance.backup) teams.push(alliance.backup);
	return teams;
}

function lineup(alliance: AllianceSelection): number[] {
	const { backup, backupReplaced } = alliance;
	return [alliance.captain, ...alliance.picks].map((team) =>
		backup && team === backupReplaced ? backup : team
	);
}

type Seeds = {
	size: AllianceCount;
	members: Map<number, number[]>;
	lineups: Map<number, number[]>;
};

function formedSeeds(alliances: AllianceSelection[], minimum: number): Seeds | null {
	const size = allianceSize(alliances.length);
	if (!size || size < minimum || alliances.some((a) => a.picks.length === 0)) return null;
	const sorted = [...alliances].sort((a, b) => a.seed - b.seed);
	if (sorted.some((a, i) => a.seed !== i + 1)) return null;
	return {
		size,
		members: new Map(sorted.map((a) => [a.seed, members(a)])),
		lineups: new Map(sorted.map((a) => [a.seed, lineup(a)]))
	};
}

function inferredSeeds(playoffs: Match[]): Seeds | null {
	const sides = new Set<string>();
	for (const m of playoffs)
		for (const side of [m.red, m.blue])
			if (side.length)
				sides.add(
					side
						.map((t) => t.team)
						.sort((a, b) => a - b)
						.join(' ')
				);
	const size = allianceSize(sides.size);
	if (!size) return null;
	const found = new Map<number, number[]>();
	for (const row of bracketFor(size)) {
		for (const color of ['red', 'blue'] as const) {
			const source = row[color];
			if (!('seed' in source) || found.has(source.seed)) continue;
			const m = playoffs.find((x) => bracketNumber(x, size) === row.match && x[color].length);
			if (m)
				found.set(
					source.seed,
					playingTeams(m[color]).map((t) => t.team)
				);
		}
	}
	if (found.size !== size) return null;
	return { size, members: found, lineups: found };
}

function bracketResults(size: AllianceCount, playoffs: Match[], seeds: Seeds): Map<number, Color> {
	const seedOf = new Map<number, number>();
	for (const [seed, teams] of seeds.members) for (const team of teams) seedOf.set(team, seed);
	const rows = new Set(bracketFor(size).map((row) => row.match));
	const decided = playoffs
		.filter((m) => m.result?.winner)
		.sort((a, b) => bracketNumber(a, size) - bracketNumber(b, size) || a.number - b.number);
	const results = new Map<number, Color>();
	for (const m of decided) {
		const n = bracketNumber(m, size);
		if (!rows.has(n)) continue;
		const winner = m.result!.winner!;
		const winnerSeed = m[winner].map((t) => seedOf.get(t.team)).find((s) => s !== undefined);
		const slot = resolveBracket(size, results).matches.find((x) => x.match === n);
		let color: Color = winner;
		if (slot && winnerSeed !== undefined) {
			if (winnerSeed === slot.redAlliance) color = 'red';
			else if (winnerSeed === slot.blueAlliance) color = 'blue';
		}
		results.set(n, color);
	}
	return results;
}

function slotChances(state: BracketState, source: Source, winProb: WinProb): Map<number, number> {
	if ('seed' in source) return new Map([[source.seed, 1]]);
	const wantWinner = 'winnerOf' in source;
	const match = state.matches.find(
		(m) => m.match === ('winnerOf' in source ? source.winnerOf : source.loserOf)
	);
	const out = new Map<number, number>();
	if (!match) return out;
	if (match.winner && match.redAlliance !== null && match.blueAlliance !== null) {
		const red = match.winner === 'red';
		const winner = red ? match.redAlliance : match.blueAlliance;
		const loser = red ? match.blueAlliance : match.redAlliance;
		out.set(wantWinner ? winner : loser, 1);
		return out;
	}
	const side = (alliance: number | null, from: Source) =>
		alliance !== null ? new Map([[alliance, 1]]) : slotChances(state, from, winProb);
	const red = side(match.redAlliance, match.red);
	const blue = side(match.blueAlliance, match.blue);
	let total = 0;
	const add = (alliance: number, p: number) => out.set(alliance, (out.get(alliance) ?? 0) + p);
	for (const [r, pr] of red) {
		for (const [b, pb] of blue) {
			if (r === b) continue;
			const p = winProb(r, b);
			const weight = pr * pb;
			add(wantWinner ? r : b, weight * p);
			add(wantWinner ? b : r, weight * (1 - p));
			total += weight;
		}
	}
	if (total > 0) for (const [alliance, p] of out) out.set(alliance, p / total);
	return out;
}

function nextWin(state: BracketState, seed: number, winProb: WinProb): number {
	const match = state.matches.find(
		(m) =>
			m.winner === null && m.needed !== false && (m.redAlliance === seed || m.blueAlliance === seed)
	);
	if (!match) return 0;
	const isRed = match.redAlliance === seed;
	const known = isRed ? match.blueAlliance : match.redAlliance;
	const opponents =
		known !== null
			? new Map([[known, 1]])
			: slotChances(state, isRed ? match.blue : match.red, winProb);
	let p = 0;
	for (const [opponent, weight] of opponents)
		p += weight * (isRed ? winProb(seed, opponent) : 1 - winProb(opponent, seed));
	return p;
}

function eventAverages(matches: Match[]): EventAnalysis['averages'] {
	let played = 0;
	let sides = 0;
	let detailed = 0;
	let score = 0;
	const sum: RatingParts = { auto: 0, hive: 0, flower: 0, garden: 0, park: 0, tips: 0 };
	for (const m of matches) {
		if (!m.result) continue;
		played++;
		for (const side of [m.result.red, m.result.blue]) {
			sides++;
			score += side.preFoulTotal;
			const breakdown = side.breakdown;
			if (!breakdown) continue;
			detailed++;
			sum.auto += side.auto;
			sum.hive += breakdown.points.teleopHive;
			sum.flower += breakdown.points.teleopFlower;
			sum.garden += breakdown.points.teleopGarden;
			sum.park += breakdown.points.teleopPark;
			sum.tips += breakdown.auto.tips + breakdown.teleop.tips;
		}
	}
	const per = (value: number) => (detailed ? points(value / detailed) : 0);
	return {
		parts: {
			auto: per(sum.auto),
			hive: per(sum.hive),
			flower: per(sum.flower),
			garden: per(sum.garden),
			park: per(sum.park),
			tips: per(sum.tips)
		},
		score: sides ? points(score / sides) : 0,
		matches: played
	};
}

export function analyzeEvent(
	bundle: EventBundle,
	context: AnalysisContext,
	options: AnalyzeOptions
): EventAnalysis {
	const sims = options.sims ?? 10_000;
	const seed = options.seed ?? 1;
	const event = toModelEvent(bundle);
	const states = numberMap(context.states);
	const previous = numberMap(context.previous);
	const priors: Priors = { params: OPR_PARAMS, states, previous };
	const run = rateSeason([event], {
		previous,
		states,
		sums: context.sums,
		swarm: SwarmBook.from(context.swarm)
	});
	const rated = run.events.get(event.code)!;
	const rater = rated.rater;
	const book = run.swarm;
	const day = dayNumber(event.start);

	const value = (team: number, track: Track = 'opr') =>
		rater.matchesPlayed(team) > 0
			? rater.value(team, track)
			: priorFor(team, priors, run.stats, day).values[trackIndex(track)];
	const current = new Map<string, MatchPrediction>();
	const predictNow = (m: ModelMatch) => {
		let p = current.get(m.key);
		if (!p) {
			p = predictMatch(rater.forecast(m.red, m.blue), {
				swarm: { red: book.chance(m.red), blue: book.chance(m.blue) }
			});
			current.set(m.key, p);
		}
		return p;
	};
	const top2 = (teams: number[]) =>
		teams.length <= 2 ? teams : [...teams].sort((a, b) => value(b) - value(a)).slice(0, 2);
	const allianceWin = (red: number[], blue: number[]) =>
		redChance(rater.forecast(top2(red), top2(blue)));

	const teamSet = new Set<number>(bundle.teams.map((t) => t.number));
	for (const m of event.matches) for (const t of [...m.red, ...m.blue]) teamSet.add(t);
	for (const r of bundle.rankings) teamSet.add(r.team);
	for (const a of bundle.alliances) for (const t of members(a)) teamSet.add(t);
	const teams = [...teamSet].sort((a, b) => a - b);
	const opr = new Map(teams.map((t) => [t, value(t)]));
	const order = [...teams].sort((a, b) => opr.get(b)! - opr.get(a)! || a - b);
	const rankOf = new Map(order.map((t, i) => [t, i + 1]));

	const byKey = new Map(event.matches.map((m) => [m.key, m]));
	const history = new Map<number, TeamRating['history']>();
	const firstPrior = new Map<number, number>();
	for (const step of rated.steps) {
		const absent = new Set(byKey.get(step.key)?.noShows ?? []);
		for (const r of step.ratings) {
			if (absent.has(r.team)) continue;
			if (!firstPrior.has(r.team)) firstPrior.set(r.team, r.before);
			const list = history.get(r.team) ?? [];
			list.push({ key: step.key, time: step.time, opr: points(r.after) });
			history.set(r.team, list);
		}
	}
	const parts = (team: number): RatingParts => ({
		auto: points(value(team, 'auto')),
		hive: points(value(team, 'hive')),
		flower: points(value(team, 'flower')),
		garden: points(value(team, 'garden')),
		park: points(value(team, 'park')),
		tips: points(value(team, 'tips'))
	});
	const sigma = SCORE_SIGMA * run.stats.sd;
	const spread = (team: number) =>
		rater.has(team)
			? rater.rating(team, sigma).sd
			: sigma / Math.sqrt(priorFor(team, priors, run.stats, day).prec);
	const ratings: TeamRating[] = order.map((team) => ({
		team,
		opr: points(opr.get(team)!),
		parts: parts(team),
		matches: rater.matchesPlayed(team),
		rank: rankOf.get(team)!,
		prior: points(firstPrior.get(team) ?? opr.get(team)!),
		sd: points(spread(team)),
		history: history.get(team) ?? []
	}));

	const forecasts: Record<string, MatchForecast> = {};
	const steps = new Map(rated.steps.map((s) => [s.key, s]));
	for (const match of bundle.matches) {
		const m = byKey.get(match.key);
		if (!m) continue;
		const step = steps.get(m.key);
		const prediction = step ? predictMatch(step.forecast, { swarm: step.swarm }) : predictNow(m);
		forecasts[m.key] = matchForecast(
			m.key,
			prediction,
			step !== undefined,
			match.result?.winner ?? null
		);
	}

	const quals = event.matches.filter((m) => m.level === 'qual');
	const remaining = quals.filter((m) => !isPlayed(m));
	let projections: Projection[] | null = null;
	if ((bundle.phase === 'upcoming' || bundle.phase === 'quals') && remaining.length > 0) {
		const field = [...new Set(quals.flatMap((m) => [...m.red, ...m.blue]))].sort((a, b) => a - b);
		projections = simulateRankings(
			{
				teams: field,
				current: currentTally(quals, bundle.rankings),
				remaining: remaining.map((m) => simMatch(m, predictNow(m)))
			},
			{ sims, seed }
		).map((p) => ({
			team: p.team,
			rankChances: p.rankChances.map(chance),
			top4: chance(p.top4),
			top8: chance(p.top8),
			expectedRs: round(p.expectedRs, 3),
			expectedRank: points(p.expectedRank)
		}));
	}

	const strength: ScheduleStrength[] = scheduleStrength({
		matches: quals,
		rating: (team) => opr.get(team) ?? value(team),
		expectedRp: (m) => {
			const p = predictNow(m);
			return { red: p.red.rp.expected, blue: p.blue.rp.expected };
		}
	}).map((s) => ({
		team: s.team,
		partners: points(s.partner),
		opponents: points(s.opponent),
		ratingRank: rankOf.get(s.team) ?? 0,
		expectedRs: points(s.expectedRs),
		actualRs: points(s.actualRs)
	}));

	const playoffMatches = bundle.matches.filter((m) => m.level === 'playoff');
	const ranked =
		bundle.rankings.length || new Set(quals.flatMap((m) => [...m.red, ...m.blue])).size;
	const expected = playoffMatches.length > 0 ? 0 : allianceCountFor(ranked);
	const seeds =
		formedSeeds(bundle.alliances, expected) ??
		(bundle.alliances.length === 0 ? inferredSeeds(playoffMatches) : null);
	let playoffs: AllianceOdds[] | null = null;
	if (seeds) {
		const winProb: WinProb = (red, blue) =>
			allianceWin(seeds.lineups.get(red) ?? [], seeds.lineups.get(blue) ?? []);
		const results = bracketResults(seeds.size, playoffMatches, seeds);
		const state = resolveBracket(seeds.size, results);
		playoffs = simulateBracket(seeds.size, winProb, results, sims, seed).map((odds) => {
			const lineupTeams = top2(seeds.lineups.get(odds.alliance) ?? []);
			return {
				seed: odds.alliance,
				teams: seeds.members.get(odds.alliance) ?? [],
				strength: points(lineupTeams.reduce((s, t) => s + (opr.get(t) ?? value(t)), 0)),
				winEvent: chance(odds.champion),
				reachFinal: chance(odds.champion + odds.finalist),
				winNext: chance(nextWin(state, odds.alliance, winProb))
			};
		});
	}

	let picks: PickAnalysis | null = null;
	const ranking = [...bundle.rankings].sort((a, b) => a.rank - b.rank).map((r) => r.team);
	const selecting =
		!seeds &&
		playoffMatches.length === 0 &&
		(bundle.phase === 'selection' || bundle.alliances.length > 0);
	if (selecting && ranking.length > 1) {
		const sorted = [...bundle.alliances].sort((a, b) => a.seed - b.seed);
		const formed: number[][] = [];
		for (const a of sorted) {
			if (a.seed !== formed.length + 1 || a.picks.length === 0) break;
			formed.push([a.captain, ...a.picks]);
		}
		const counted = allianceCountFor(ranking.length);
		const size =
			[2, 4, 6, 8].find((n) => n >= Math.max(counted, sorted.length)) ?? (counted || null);
		const taken = new Set(formed.flat());
		const pool = ranking.filter((t) => !taken.has(t));
		if (size && formed.length < size && pool.length > 1) {
			const alliances = size as AllianceCount;
			const onClock = formed.length + 1;
			const rest = pool.slice(1);
			const futureCount = Math.max(0, alliances - onClock);
			const future = new Set(rest.slice(0, futureCount));
			const choices = analyzePicks(
				{
					alliances,
					ranking,
					formed,
					strength: (team) => opr.get(team) ?? value(team),
					winProb: allianceWin
				},
				{ sims: options.pickSims ?? 2_000, seed }
			);
			picks = {
				seed: onClock,
				captain: pool[0],
				options: choices.map((o) => ({
					team: o.team,
					opr: points(opr.get(o.team) ?? value(o.team)),
					auto: points(value(o.team, 'auto')),
					tips: points(value(o.team, 'tips')),
					park: points(value(o.team, 'park')),
					winRound1: chance(o.firstMatchWin),
					reachUpperFinal: chance(o.upperFinal),
					winEvent: chance(o.champion),
					promotesCaptain: future.has(o.team)
						? (rest.filter((t) => t !== o.team)[futureCount - 1] ?? null)
						: null
				}))
			};
		}
	}

	return {
		code: bundle.event.code,
		generatedAt: options.now,
		model: MODEL,
		ratings,
		forecasts,
		timing: eventTiming(bundle, options.now),
		projections,
		strength,
		playoffs,
		picks,
		averages: eventAverages(bundle.matches)
	};
}

export function retime(analysis: EventAnalysis, bundle: EventBundle, now: number): EventAnalysis {
	return { ...analysis, generatedAt: now, timing: eventTiming(bundle, now) };
}
