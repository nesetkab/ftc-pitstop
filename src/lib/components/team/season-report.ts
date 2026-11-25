import type { EventAnalysis, SeasonRating } from '#lib/analysis/types.ts';
import {
	RP_KEYS,
	RP_LABELS,
	rpTakeaways,
	type Candidate,
	type RpHabits,
	type RpKey
} from '#lib/components/event/report.ts';
import { fixed, integer } from '#lib/format/number.ts';
import { ordinal as plainOrdinal } from '#lib/format/ordinal.ts';
import { pct } from '#lib/format/pct.ts';
import { regionName } from '#lib/format/places.ts';
import type { AllianceColor, EventBundle, Match, TeamSeason } from '#lib/types.ts';
import { localDate } from '#lib/format/calendar.ts';

export type SeasonBundle = Pick<EventBundle, 'matches'> &
	Partial<Pick<EventBundle, 'teams' | 'advancement' | 'phase'>>;

export interface AdvancementRow {
	code: string;
	event: string;
	to: string | null;
	toCode: string | null;
}

export interface UpcomingEventRow {
	code: string;
	name: string;
	start: string;
	end: string;
	live: boolean;
	registered: number | null;
	kind: 'projection' | 'opr' | 'none';
	outlook: string;
}

export interface BestMatch {
	code: string;
	key: string;
	label: string;
	score: number;
}

export interface AllyRow {
	team: number;
	name: string | null;
	matches: number;
	wins: number;
	losses: number;
	ties: number;
	best: BestMatch | null;
	opr: number | null;
	rank: number | null;
}

export interface AllySummary {
	partners: AllyRow[];
	opponents: AllyRow[];
	partnerCount: number;
	opponentCount: number;
}

export interface SeasonFacts {
	stats: {
		rank: number | null;
		of: number | null;
		events: number;
		record: { wins: number; losses: number; ties: number } | null;
		region: { code: string; rank: number; of: number } | null;
	};
	comparison: { key: string; value: number; percentile: number | null }[];
	trend: { label: string; value: number }[];
	advancement: AdvancementRow[];
	rookie: boolean;
	scores: number[];
	rp: RpHabits | null;
}

export const ALLY_LIMIT = 12;
const MAX_UPCOMING = 3;
const MAX_TAKEAWAYS = 4;
const MIN_SCORES = 6;

const PART_PHRASES: Record<string, string> = {
	auto: 'autonomous',
	teleop: 'teleop',
	hive: 'hive scoring',
	flower: 'flower scoring',
	garden: 'garden scoring',
	park: 'parking',
	tips: 'hive tips'
};

const PART_FLOOR: Record<string, number> = {
	auto: 3,
	teleop: 5,
	hive: 3,
	flower: 3,
	garden: 2,
	park: 2,
	tips: 0.5
};

function ordinal(value: number): string {
	return `${integer(value)}${plainOrdinal(value).slice(String(value).length)}`;
}

function sideOf(match: Match, team: number): AllianceColor | null {
	if (match.red.some((entry) => entry.team === team)) return 'red';
	if (match.blue.some((entry) => entry.team === team)) return 'blue';
	return null;
}

function other(color: AllianceColor): AllianceColor {
	return color === 'red' ? 'blue' : 'red';
}

type Played = { code: string; match: Match; color: AllianceColor; dq: boolean };

export function playedMatches(
	season: TeamSeason,
	bundles: Record<string, SeasonBundle | null>
): Played[] {
	const team = season.team.number;
	return season.events.flatMap(({ event }) => {
		const bundle = bundles[event.code];
		if (!bundle) return [];
		return bundle.matches.flatMap((match) => {
			const color = match.result ? sideOf(match, team) : null;
			const seat = color ? match[color].find((entry) => entry.team === team) : undefined;
			if (!color || !seat || seat.noShow || seat.surrogate) return [];
			return [{ code: event.code, match, color, dq: seat.dq }];
		});
	});
}

export function allianceScores(played: Played[]): number[] {
	return played.flatMap(({ match, color }) => (match.result ? [match.result[color].total] : []));
}

export function rpHabits(
	played: Played[],
	bundles: Record<string, SeasonBundle | null>
): RpHabits | null {
	const counted = played.filter(
		({ match, color, dq }) => match.level === 'qual' && !dq && match.result?.[color].breakdown
	);
	if (counted.length === 0) return null;
	const codes = new Set(counted.map((entry) => entry.code));
	let sides = 0;
	const field: Record<RpKey, number> = { swarm: 0, pollinator1: 0, pollinator2: 0 };
	for (const code of codes) {
		for (const match of bundles[code]?.matches ?? []) {
			if (match.level !== 'qual' || !match.result) continue;
			for (const color of ['red', 'blue'] as const) {
				const rp = match.result[color].breakdown?.rp;
				if (!rp) continue;
				sides += 1;
				for (const key of RP_KEYS) field[key] += Number(rp[key]);
			}
		}
	}
	return {
		played: counted.length,
		habits: RP_KEYS.map((key) => ({
			key,
			label: RP_LABELS[key],
			earned: counted.filter(({ match, color }) => match.result?.[color].breakdown?.rp[key]).length,
			event: sides ? field[key] / sides : 0
		}))
	};
}

export function oprRank(pool: SeasonRating[], mine: SeasonRating): number {
	return (
		1 +
		pool.filter(
			(entry) => entry.opr > mine.opr || (entry.opr === mine.opr && entry.team < mine.team)
		).length
	);
}

function blank(team: number, name: string | null): AllyRow {
	return { team, name, matches: 0, wins: 0, losses: 0, ties: 0, best: null, opr: null, rank: null };
}

function tally(row: AllyRow, entry: Played) {
	const result = entry.match.result;
	if (!result) return;
	row.matches += 1;
	if (result.winner === entry.color) row.wins += 1;
	else if (result.winner === null) row.ties += 1;
	else row.losses += 1;
	const score = result[entry.color].total;
	if (!row.best || score > row.best.score) {
		row.best = { code: entry.code, key: entry.match.key, label: entry.match.label, score };
	}
}

export function allySummary(
	season: TeamSeason,
	bundles: Record<string, SeasonBundle | null>,
	pool: SeasonRating[],
	played: Played[] = playedMatches(season, bundles)
): AllySummary {
	const team = season.team.number;
	const names = new Map<number, string>();
	for (const { event } of season.events)
		for (const entry of bundles[event.code]?.teams ?? []) names.set(entry.number, entry.name);
	const ratings = new Map(pool.map((rating) => [rating.team, rating]));
	const ranked = [...pool].sort((a, b) => b.opr - a.opr || a.team - b.team);
	const worldRank = new Map(ranked.map((rating, index) => [rating.team, index + 1]));
	const partners = new Map<number, AllyRow>();
	const opponents = new Map<number, AllyRow>();
	const row = (rows: Map<number, AllyRow>, number: number) => {
		let found = rows.get(number);
		if (!found) {
			found = blank(number, names.get(number) ?? null);
			found.opr = ratings.get(number)?.opr ?? null;
			found.rank = worldRank.get(number) ?? null;
			rows.set(number, found);
		}
		return found;
	};
	for (const entry of played) {
		const { match, color } = entry;
		for (const seat of match[color]) {
			if (seat.team !== team) tally(row(partners, seat.team), entry);
		}
		for (const seat of match[other(color)]) {
			const against = row(opponents, seat.team);
			const result = match.result;
			if (!result) continue;
			against.matches += 1;
			if (result.winner === color) against.wins += 1;
			else if (result.winner === null) against.ties += 1;
			else against.losses += 1;
		}
	}
	const partnerRows = [...partners.values()].sort(
		(a, b) =>
			b.matches - a.matches ||
			b.wins - a.wins ||
			(b.best?.score ?? 0) - (a.best?.score ?? 0) ||
			a.team - b.team
	);
	const opponentRows = [...opponents.values()].sort(
		(a, b) =>
			(b.opr ?? -Infinity) - (a.opr ?? -Infinity) || b.matches - a.matches || a.team - b.team
	);
	return {
		partners: partnerRows.slice(0, ALLY_LIMIT),
		opponents: opponentRows.slice(0, ALLY_LIMIT),
		partnerCount: partnerRows.length,
		opponentCount: opponentRows.length
	};
}

export function advancementRows(
	season: TeamSeason,
	bundles: Record<string, SeasonBundle | null>
): AdvancementRow[] {
	const team = season.team.number;
	const seen = new Set<string>();
	return season.events.flatMap(({ event }) => {
		const advancement = bundles[event.code]?.advancement;
		if (!advancement) return [];
		const slot = advancement.teams.find(
			(entry) => entry.team === team && !entry.declined && entry.status !== 'ineligible'
		);
		if (!slot || slot.status === 'already-advancing') return [];
		const target = advancement.advancesTo ?? `${event.code}:next`;
		if (seen.has(target)) return [];
		seen.add(target);
		return [
			{
				code: event.code,
				event: event.name,
				to: advancement.advancesToName ?? advancement.advancesTo,
				toCode: advancement.advancesTo
			}
		];
	});
}

export function upcomingEvents(
	season: TeamSeason,
	bundles: Record<string, SeasonBundle | null>,
	analyses: Record<string, Pick<EventAnalysis, 'projections'> | null>,
	pool: SeasonRating[],
	now: number
): UpcomingEventRow[] {
	const team = season.team.number;
	const mine = pool.find((rating) => rating.team === team) ?? null;
	return upcomingEntries(season, now).map(({ event }) => {
		const bundle = bundles[event.code] ?? null;
		const live = localDate(now, event.timezone) >= event.start;
		const field = new Set(bundle?.teams?.map((entry) => entry.number) ?? []);
		for (const match of bundle?.matches ?? [])
			for (const seat of [...match.red, ...match.blue]) field.add(seat.team);
		const registered = bundle ? field.size : null;
		const projections = analyses[event.code]?.projections ?? null;
		const projection = projections?.find((entry) => entry.team === team) ?? null;
		const base = { code: event.code, name: event.name, start: event.start, end: event.end, live };
		if (projection && projections) {
			const of = projections.length;
			const top = of > 8 ? `, ${pct(projection.top8)} chance of top 8` : '';
			return {
				...base,
				registered,
				kind: 'projection' as const,
				outlook: `Expected rank ${Math.max(1, Math.round(projection.expectedRank))} of ${of}${top}`
			};
		}
		if (!bundle || field.size === 0) {
			return { ...base, registered, kind: 'none' as const, outlook: 'Team list not out yet' };
		}
		const rated = pool.filter((rating) => field.has(rating.team));
		if (!mine || !field.has(team) || rated.length < 2) {
			return {
				...base,
				registered,
				kind: 'none' as const,
				outlook: mine ? `${integer(field.size)} teams registered` : 'No season OPR yet'
			};
		}
		const rank = oprRank(rated, mine);
		return {
			...base,
			registered,
			kind: 'opr' as const,
			outlook: `${ordinal(rank)} of ${rated.length} rated teams by season OPR`
		};
	});
}

export function upcomingEntries(season: TeamSeason, now: number): TeamSeason['events'] {
	return season.events
		.filter(({ event }) => localDate(now, event.timezone) <= event.end)
		.sort((a, b) => a.event.start.localeCompare(b.event.start))
		.slice(0, MAX_UPCOMING);
}

function mean(values: number[]): number {
	return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function shifted(change: number, before: number): boolean {
	return Math.abs(change) >= Math.max(8, Math.abs(before) * 0.15);
}

function standingTakeaways(stats: SeasonFacts['stats']): Candidate[] {
	const { rank, of, region } = stats;
	const top =
		rank !== null && of !== null && of > 0 ? Math.max(1, Math.ceil((100 * rank) / of)) : null;
	const notableWorld = top !== null && top <= 10;
	const notableRegion = region !== null && region.of >= 5 && region.rank <= 3;
	if (!notableWorld && !notableRegion) return [];
	const place = region && notableRegion ? regionPlace(region.rank, regionName(region.code)) : null;
	const text = notableWorld
		? `Top ${top}% worldwide by season OPR${place ? `, ${place}` : ''}`
		: `${place} by season OPR`;
	return [{ weight: 85, text }];
}

function regionPlace(rank: number, name: string): string {
	return rank === 1 ? `best in ${name}` : `${ordinal(rank)} in ${name}`;
}

function partTakeaways(comparison: SeasonFacts['comparison']): Candidate[] {
	const scored = comparison.filter((row) => row.key in PART_PHRASES);
	const parts = scored.some((row) => row.key === 'hive')
		? scored.filter((row) => row.key !== 'teleop')
		: scored;
	const best = parts
		.filter(
			(row) => row.percentile !== null && row.percentile >= 75 && row.value >= PART_FLOOR[row.key]
		)
		.sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0) || b.value - a.value)[0];
	if (!best) return [];
	return [
		{
			weight: 80,
			text: `Strongest at ${PART_PHRASES[best.key]}, better than ${best.percentile}% of teams`
		}
	];
}

function trendTakeaways(trend: SeasonFacts['trend']): Candidate[] {
	if (trend.length < 2) return [];
	const first = trend[0].value;
	const last = trend[trend.length - 1].value;
	const count = `${trend.length} events`;
	if (shifted(last - first, first)) {
		const word = last > first ? 'rose' : 'fell';
		return [
			{ weight: 75, text: `OPR ${word} from ${fixed(first)} to ${fixed(last)} over ${count}` }
		];
	}
	const values = trend.map((point) => point.value);
	const low = Math.min(...values);
	const high = Math.max(...values);
	if (shifted(high - low, low)) {
		const text =
			last < high
				? `OPR peaked at ${fixed(high)} and ended at ${fixed(last)} over ${count}`
				: `OPR dipped to ${fixed(low)} and ended at ${fixed(last)} over ${count}`;
		return [{ weight: 60, text }];
	}
	return [
		{
			weight: 35,
			text: `Steady OPR over ${count}, between ${fixed(low)} and ${fixed(high)}`
		}
	];
}

function consistencyTakeaways(scores: number[]): Candidate[] {
	if (scores.length < MIN_SCORES) return [];
	const average = mean(scores);
	const band = Math.max(10, average * 0.15);
	const close = scores.filter((score) => Math.abs(score - average) <= band).length;
	const share = close / scores.length;
	if (share >= 0.75) {
		return [
			{
				weight: 50,
				text: `Consistent: ${close} of ${scores.length} alliance scores within ${integer(band)} points of the ${integer(average)} average`
			}
		];
	}
	if (share <= 0.4) {
		return [
			{
				weight: 52,
				text: `Uneven scores: from ${integer(Math.min(...scores))} to ${integer(Math.max(...scores))} across ${scores.length} matches`
			}
		];
	}
	return [];
}

function advancementTakeaways(facts: SeasonFacts): Candidate[] {
	const rookie = facts.rookie ? ' in its rookie season' : '';
	return facts.advancement.map((row) => ({
		weight: 100,
		text: `Advanced to ${row.to ?? 'the next level'} from ${row.event}${rookie}`
	}));
}

export function seasonTakeaways(facts: SeasonFacts): string[] {
	const played = facts.stats.events > 0;
	const standing = played ? standingTakeaways(facts.stats) : [];
	const candidates = [
		...advancementTakeaways(facts),
		...standing,
		...(played
			? [
					...partTakeaways(facts.comparison),
					...trendTakeaways(facts.trend),
					...rpTakeaways(facts.rp),
					...consistencyTakeaways(facts.scores)
				]
			: [])
	].sort((a, b) => b.weight - a.weight);
	return candidates.slice(0, MAX_TAKEAWAYS).map((entry) => entry.text);
}
