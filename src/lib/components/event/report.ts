import type { EventAnalysis, RatingParts, SeasonRating, TeamRating } from '#lib/analysis/types.ts';
import { opposite } from '#lib/components/event/matches.ts';
import { fixed, integer } from '#lib/format/number.ts';
import { ordinal } from '#lib/format/ordinal.ts';
import { PART_LABELS } from '#lib/game/biobuzz.ts';
import type { AllianceColor, EventBundle, Match, Ranking } from '#lib/types.ts';

export const REPORT_PARTS = [
	'opr',
	'auto',
	'teleop',
	'hive',
	'flower',
	'garden',
	'park',
	'tips'
] as const;

export type ReportPart = (typeof REPORT_PARTS)[number];

export const REPORT_PART_LABELS: Record<ReportPart, string> = {
	opr: 'aOPR',
	auto: PART_LABELS.auto,
	teleop: PART_LABELS.teleop,
	hive: PART_LABELS.hive,
	flower: PART_LABELS.flower,
	garden: PART_LABELS.garden,
	park: PART_LABELS.park,
	tips: PART_LABELS.tips
};

const PHRASES: Record<ReportPart, string> = {
	opr: 'overall scoring',
	auto: 'autonomous',
	teleop: 'teleop',
	hive: 'hive scoring',
	flower: 'flower scoring',
	garden: 'garden scoring',
	park: 'parking',
	tips: 'hive tips'
};

const MEANINGFUL: Record<ReportPart, number> = {
	opr: 5,
	auto: 3,
	teleop: 5,
	hive: 3,
	flower: 3,
	garden: 2,
	park: 2,
	tips: 0.5
};

export const RP_KEYS = ['swarm', 'pollinator1', 'pollinator2'] as const;

export type RpKey = (typeof RP_KEYS)[number];

export const RP_LABELS: Record<RpKey, string> = {
	swarm: 'Swarm',
	pollinator1: 'Pollinator 1',
	pollinator2: 'Pollinator 2'
};

export type MatchOutcome = 'win' | 'loss' | 'tie';

export type PartRow = {
	key: ReportPart;
	label: string;
	value: number;
	average: number;
	rank: number;
	of: number;
	season: number | null;
};

export type PlayedMatch = {
	key: string;
	label: string;
	level: Match['level'];
	alliance: AllianceColor;
	score: number;
	opponentScore: number;
	result: MatchOutcome;
	partners: number[];
	opponents: number[];
	surrogate: boolean;
	dq: boolean;
	rp: Record<RpKey, boolean> | null;
};

export type MatchRef = { key: string; label: string; score: number };

export type Spread = {
	count: number;
	average: number;
	sd: number;
	best: MatchRef;
	worst: MatchRef;
	rank: number | null;
	of: number | null;
};

export type RpHabit = { key: RpKey; label: string; earned: number; event: number };

export type RpHabits = { played: number; habits: RpHabit[] };

export type Trend = {
	first: number;
	second: number;
	firstCount: number;
	secondCount: number;
	recent: { average: number; before: number } | null;
};

export type UpcomingMatch = {
	key: string;
	label: string;
	time: number | null;
	alliance: AllianceColor;
	partners: number[];
	opponents: number[];
	win: number | null;
	score: number | null;
	opponentScore: number | null;
};

export type TeamReport = {
	team: number;
	name: string | null;
	ranking: Ranking | null;
	rankedOf: number;
	league: boolean;
	rated: 'here' | 'expected' | null;
	parts: PartRow[] | null;
	season: { opr: number; rank: number; of: number } | null;
	played: PlayedMatch[];
	spread: Spread | null;
	rp: RpHabits | null;
	trend: Trend | null;
	upcoming: UpcomingMatch[];
	eventStarted: boolean;
	scale: number;
	eventAverage: number | null;
	takeaways: string[];
};

export type ReportInput = {
	bundle: Pick<EventBundle, 'event' | 'teams' | 'matches' | 'rankings'>;
	analysis: Pick<EventAnalysis, 'ratings' | 'forecasts' | 'timing'> | null;
	season: SeasonRating[] | null;
	seasonCount: number | null;
};

const MIN_RATED = 3;
const MIN_SPREAD = 4;
const MIN_POOL = 4;
const MAX_TAKEAWAYS = 4;

function mean(values: number[]): number {
	return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function deviation(values: number[]): number {
	if (values.length < 2) return 0;
	const average = mean(values);
	return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function partValue(key: ReportPart, opr: number, parts: RatingParts): number {
	if (key === 'opr') return opr;
	if (key === 'teleop') return opr - parts.auto;
	return parts[key];
}

function outcome(match: Match, color: AllianceColor): MatchOutcome {
	const winner = match.result?.winner ?? null;
	if (winner === color) return 'win';
	return winner === null ? 'tie' : 'loss';
}

function playedBy(matches: Match[]): Map<number, PlayedMatch[]> {
	const byTeam = new Map<number, PlayedMatch[]>();
	for (const match of matches) {
		const result = match.result;
		if (!result) continue;
		for (const color of ['red', 'blue'] as const) {
			const score = result[color];
			const breakdown = score.breakdown;
			for (const entry of match[color]) {
				if (entry.noShow) continue;
				const list = byTeam.get(entry.team) ?? [];
				list.push({
					key: match.key,
					label: match.label,
					level: match.level,
					alliance: color,
					score: score.preFoulTotal,
					opponentScore: result[opposite(color)].preFoulTotal,
					result: outcome(match, color),
					partners: match[color].map((t) => t.team).filter((t) => t !== entry.team),
					opponents: match[opposite(color)].map((t) => t.team),
					surrogate: entry.surrogate,
					dq: entry.dq,
					rp: breakdown ? { ...breakdown.rp } : null
				});
				byTeam.set(entry.team, list);
			}
		}
	}
	return byTeam;
}

function rpCounted(match: PlayedMatch): boolean {
	return match.level === 'qual' && !match.surrogate && !match.dq && match.rp !== null;
}

function eventRpRates(matches: Match[]): Record<RpKey, number> {
	let sides = 0;
	const earned: Record<RpKey, number> = { swarm: 0, pollinator1: 0, pollinator2: 0 };
	for (const match of matches) {
		if (match.level !== 'qual' || !match.result) continue;
		for (const color of ['red', 'blue'] as const) {
			const rp = match.result[color].breakdown?.rp;
			if (!rp) continue;
			sides++;
			for (const key of RP_KEYS) earned[key] += Number(rp[key]);
		}
	}
	return {
		swarm: sides ? earned.swarm / sides : 0,
		pollinator1: sides ? earned.pollinator1 / sides : 0,
		pollinator2: sides ? earned.pollinator2 / sides : 0
	};
}

function spreadOf(played: PlayedMatch[]): Omit<Spread, 'rank' | 'of'> | null {
	if (played.length === 0) return null;
	const scores = played.map((match) => match.score);
	const ref = (match: PlayedMatch): MatchRef => ({
		key: match.key,
		label: match.label,
		score: match.score
	});
	const best = played.reduce((top, match) => (match.score > top.score ? match : top));
	const worst = played.reduce((low, match) => (match.score < low.score ? match : low));
	return {
		count: played.length,
		average: mean(scores),
		sd: deviation(scores),
		best: ref(best),
		worst: ref(worst)
	};
}

function trendOf(played: PlayedMatch[]): Trend | null {
	if (played.length < 4) return null;
	const scores = played.map((match) => match.score);
	const cut = Math.floor(scores.length / 2);
	const recent =
		scores.length >= 7
			? { average: mean(scores.slice(-3)), before: mean(scores.slice(0, -3)) }
			: null;
	return {
		first: mean(scores.slice(0, cut)),
		second: mean(scores.slice(cut)),
		firstCount: cut,
		secondCount: scores.length - cut,
		recent
	};
}

function rankIn(values: number[], value: number, higher = true): number {
	return 1 + values.filter((other) => (higher ? other > value : other < value)).length;
}

export function createReporter(input: ReportInput) {
	const { bundle, analysis } = input;
	const played = playedBy(bundle.matches);
	const rates = eventRpRates(bundle.matches);
	const scores = bundle.matches.flatMap((match) =>
		match.result ? [match.result.red.preFoulTotal, match.result.blue.preFoulTotal] : []
	);
	const eventStarted = scores.length > 0;
	const scale = Math.max(1, ...scores);
	const eventAverage = eventStarted ? mean(scores) : null;
	const names = new Map(bundle.teams.map((team) => [team.number, team.name]));
	const rankings = new Map(bundle.rankings.map((row) => [row.team, row]));
	const season = new Map((input.season ?? []).map((rating) => [rating.team, rating]));
	const here = new Set(bundle.teams.map((team) => team.number));
	const known = new Set([...here, ...played.keys(), ...rankings.keys()]);
	for (const match of bundle.matches)
		for (const entry of [...match.red, ...match.blue]) known.add(entry.team);

	const ratings = analysis?.ratings ?? [];
	const pool = ratings.filter((rating) =>
		eventStarted ? played.has(rating.team) : here.has(rating.team)
	);
	const columns = new Map(
		REPORT_PARTS.map((key) => [key, pool.map((rating) => partValue(key, rating.opr, rating.parts))])
	);
	const spreads = [...played.values()]
		.filter((list) => list.length >= MIN_SPREAD)
		.map((list) => deviation(list.map((match) => match.score)));

	function partRows(rating: TeamRating): PartRow[] {
		const mine = season.get(rating.team) ?? null;
		return REPORT_PARTS.map((key) => {
			const values = columns.get(key) ?? [];
			const value = partValue(key, rating.opr, rating.parts);
			return {
				key,
				label: REPORT_PART_LABELS[key],
				value,
				average: mean(values),
				rank: rankIn(values, value),
				of: values.length,
				season: mine ? partValue(key, mine.opr, mine.parts) : null
			};
		});
	}

	function upcomingFor(team: number): UpcomingMatch[] {
		return bundle.matches.flatMap((match) => {
			if (match.result) return [];
			const color = match.red.some((t) => t.team === team)
				? 'red'
				: match.blue.some((t) => t.team === team)
					? 'blue'
					: null;
			if (!color) return [];
			const forecast = analysis?.forecasts[match.key];
			const timing = analysis?.timing.matches[match.key];
			return [
				{
					key: match.key,
					label: match.label,
					time: timing?.expectedStart ?? match.scheduledTime,
					alliance: color,
					partners: match[color].map((t) => t.team).filter((t) => t !== team),
					opponents: match[opposite(color)].map((t) => t.team),
					win: forecast ? forecast[color].win : null,
					score: forecast ? forecast[color].score : null,
					opponentScore: forecast ? forecast[opposite(color)].score : null
				}
			];
		});
	}

	return function report(team: number): TeamReport | null {
		if (!known.has(team)) return null;
		const matches = played.get(team) ?? [];
		const rating = pool.find((entry) => entry.team === team) ?? null;
		const mine = season.get(team) ?? null;
		const base = spreadOf(matches);
		const spread: Spread | null = base
			? {
					...base,
					rank:
						matches.length >= MIN_SPREAD && spreads.length >= MIN_POOL
							? rankIn(spreads, base.sd, false)
							: null,
					of: matches.length >= MIN_SPREAD && spreads.length >= MIN_POOL ? spreads.length : null
				}
			: null;
		const counted = matches.filter(rpCounted);
		const rp: RpHabits | null =
			counted.length > 0
				? {
						played: counted.length,
						habits: RP_KEYS.map((key) => ({
							key,
							label: RP_LABELS[key],
							earned: counted.filter((match) => match.rp?.[key]).length,
							event: rates[key]
						}))
					}
				: null;
		const ranking = rankings.get(team) ?? null;
		const partial: Omit<TeamReport, 'takeaways'> = {
			team,
			name: names.get(team) ?? ranking?.name ?? null,
			ranking,
			rankedOf: bundle.rankings.length,
			league: bundle.event.type === 'LeagueMeet',
			rated: rating ? (eventStarted ? 'here' : 'expected') : null,
			parts: rating ? partRows(rating) : null,
			season:
				mine && input.seasonCount
					? { opr: mine.opr, rank: mine.rank, of: input.seasonCount }
					: null,
			played: matches,
			spread,
			rp,
			trend: trendOf(matches.filter((match) => match.level === 'qual')),
			upcoming: upcomingFor(team),
			eventStarted,
			scale,
			eventAverage
		};
		return { ...partial, takeaways: takeaways(partial) };
	};
}

export type Candidate = { weight: number; text: string };

function strongCut(of: number): number {
	return Math.max(3, Math.round(of * 0.1));
}

function weakCut(of: number): number {
	return of - Math.max(2, Math.round(of * 0.15));
}

function partTakeaways(report: Omit<TeamReport, 'takeaways'>): Candidate[] {
	if (!report.parts) return [];
	const expected = report.rated === 'expected';
	if (!expected && report.played.length < MIN_RATED) return [];
	const where = expected ? 'by season form' : 'at this event';
	const rows = report.parts.filter((row) => row.of >= MIN_POOL);
	const strong = rows
		.filter(
			(row) =>
				row.key !== 'opr' &&
				row.key !== 'teleop' &&
				row.rank <= strongCut(row.of) &&
				row.value > row.average &&
				row.value >= MEANINGFUL[row.key]
		)
		.sort((a, b) => a.rank - b.rank)
		.slice(0, 2)
		.map((row) => ({
			weight: 90 - row.rank,
			text: `${row.rank === 1 ? 'Best' : `${ordinal(row.rank)}-best`} ${PHRASES[row.key]} ${where}`
		}));
	if (expected) return strong;
	const weak = rows
		.filter(
			(row) =>
				row.key !== 'opr' &&
				row.key !== 'teleop' &&
				row.rank > weakCut(row.of) &&
				row.average >= MEANINGFUL[row.key]
		)
		.sort((a, b) => b.rank / b.of - a.rank / a.of)
		.slice(0, 1)
		.map((row) => ({
			weight: 60,
			text: `Weak ${PHRASES[row.key]}: ${ordinal(row.rank)} of ${row.of} ${where}`
		}));
	return [...strong, ...weak];
}

export function rpTakeaways(rp: RpHabits | null): Candidate[] {
	if (!rp || rp.played < 3) return [];
	const habit = (key: RpKey) => rp.habits.find((entry) => entry.key === key) as RpHabit;
	const share = (entry: RpHabit) => entry.earned / rp.played;
	const of = `${rp.played} matches`;
	const out: Candidate[] = [];
	const swarm = habit('swarm');
	const p1 = habit('pollinator1');
	const p2 = habit('pollinator2');
	if (share(swarm) >= 0.75 && swarm.event < 0.6) {
		out.push({ weight: 58, text: `Earns Swarm in ${swarm.earned} of ${of}` });
	} else if (share(swarm) <= 0.2 && swarm.event >= 0.3) {
		out.push({ weight: 74, text: `Rarely earns Swarm: ${swarm.earned} of ${of}` });
	}
	if (share(p2) >= 0.5 && p2.event < 0.5) {
		out.push({ weight: 70, text: `Earns Pollinator 2 in ${p2.earned} of ${of}` });
	} else if (share(p1) >= 0.75 && p1.event < 0.6) {
		out.push({ weight: 56, text: `Earns Pollinator 1 in ${p1.earned} of ${of}` });
	} else if (share(p1) <= 0.2 && p1.event >= 0.25) {
		out.push({ weight: 75, text: `Rarely earns Pollinator: ${p1.earned} of ${of}` });
	}
	return out;
}

function shifted(change: number, before: number): boolean {
	return Math.abs(change) >= Math.max(10, before * 0.15);
}

function trendTakeaways(trend: Trend | null): Candidate[] {
	if (!trend) return [];
	const { recent } = trend;
	if (recent && shifted(recent.average - recent.before, recent.before)) {
		const word = recent.average < recent.before ? 'dropped' : 'rose';
		return [
			{
				weight: 80,
				text: `Scores ${word} in the last 3 matches: ${integer(recent.average)} average vs ${integer(recent.before)} before`
			}
		];
	}
	if (shifted(trend.second - trend.first, trend.first)) {
		const word = trend.second > trend.first ? 'rose' : 'fell';
		return [
			{
				weight: 66,
				text: `Scores ${word} through the event: ${integer(trend.first)} average early, ${integer(trend.second)} later`
			}
		];
	}
	return [];
}

function spreadTakeaways(spread: Spread | null): Candidate[] {
	if (!spread || spread.rank === null || spread.of === null) return [];
	if (spread.rank <= Math.max(2, Math.round(spread.of * 0.15))) {
		return [
			{
				weight: 50,
				text: `Consistent scores: ${spread.rank === 1 ? '' : `${ordinal(spread.rank)}-`}smallest spread of ${spread.of} teams`
			}
		];
	}
	if (spread.rank > weakCut(spread.of)) {
		const widest = spread.of - spread.rank + 1;
		return [
			{
				weight: 52,
				text: `Uneven scores: ${widest === 1 ? '' : `${ordinal(widest)}-`}widest spread of ${spread.of} teams`
			}
		];
	}
	return [];
}

function seasonTakeaways(report: Omit<TeamReport, 'takeaways'>): Candidate[] {
	const opr = report.parts?.find((row) => row.key === 'opr');
	if (!opr || !report.season || report.rated !== 'here' || report.played.length < MIN_RATED) {
		return [];
	}
	const change = opr.value - report.season.opr;
	if (Math.abs(change) < Math.max(8, report.season.opr * 0.15)) return [];
	const word = change > 0 ? 'Above' : 'Below';
	return [
		{
			weight: 55,
			text: `${word} season form: ${fixed(opr.value)} aOPR here vs ${fixed(report.season.opr)} for the season`
		}
	];
}

function outlookTakeaways(upcoming: UpcomingMatch[]): Candidate[] {
	const chances = upcoming.flatMap((match) => (match.win === null ? [] : [match.win]));
	if (chances.length < 2) return [];
	const count = `${chances.length} remaining matches`;
	if (chances.every((chance) => chance >= 0.65)) {
		return [{ weight: 45, text: `Favored in all ${count}` }];
	}
	if (chances.every((chance) => chance <= 0.35)) {
		return [{ weight: 45, text: `Underdog in all ${count}` }];
	}
	return [];
}

function fallbacks(report: Omit<TeamReport, 'takeaways'>): Candidate[] {
	const out: Candidate[] = [];
	const { played } = report;
	if (played.length === 1) {
		const match = played[0];
		out.push({
			weight: 20,
			text: `One match played so far: alliance scored ${integer(match.score)} in ${match.label}`
		});
	}
	const best = (report.parts ?? [])
		.filter(
			(row) =>
				row.key !== 'opr' &&
				row.key !== 'teleop' &&
				row.of >= MIN_POOL &&
				row.value >= MEANINGFUL[row.key]
		)
		.sort((a, b) => a.rank - b.rank)[0];
	if (best && report.rated === 'here' && played.length > 1) {
		out.push({
			weight: 18,
			text: `Best part: ${PHRASES[best.key]}, ${ordinal(best.rank)} of ${best.of} at this event`
		});
	}
	return out.sort((a, b) => b.weight - a.weight);
}

export function takeaways(report: Omit<TeamReport, 'takeaways'>): string[] {
	if (report.eventStarted && report.played.length === 0) {
		const next = report.upcoming[0];
		const first = next
			? `No matches played here yet; first is ${next.label}`
			: 'Did not play a match at this event';
		return [first, ...fallbacks(report).map((entry) => entry.text)].slice(0, 2);
	}
	const candidates = [
		...partTakeaways(report),
		...trendTakeaways(report.trend),
		...rpTakeaways(report.rp),
		...seasonTakeaways(report),
		...spreadTakeaways(report.spread),
		...outlookTakeaways(report.upcoming)
	].sort((a, b) => b.weight - a.weight);
	const picked = candidates.slice(0, MAX_TAKEAWAYS).map((entry) => entry.text);
	for (const entry of fallbacks(report)) {
		if (picked.length >= 2) break;
		if (!picked.includes(entry.text)) picked.push(entry.text);
	}
	return picked;
}
