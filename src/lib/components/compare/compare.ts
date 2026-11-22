import type { SeasonRating, SeasonRatings } from '#lib/analysis/types.ts';
import { awardLabel, ratedTeams } from '#lib/components/team/team-view.ts';
import { placeName } from '#lib/format/places.ts';
import { fixed, integer, MISSING, record } from '#lib/format/index.ts';
import { PART_LABELS } from '#lib/game/biobuzz.ts';
import type { AllianceColor, EventBundle, Match, TeamSeason, TeamSeasonEvent } from '#lib/types.ts';

export const MAX_COMPARE = 4;
export const MAX_SHARED_EVENTS = 10;

const WINNING_ALLIANCE = 13;
const FINALIST_ALLIANCE = 12;

export interface CompareTeam {
	number: number;
	name: string;
	place: string;
}

export interface CompareRow {
	key: string;
	label: string;
	values: string[];
	best: number[];
	nested: boolean;
}

export interface Tally {
	wins: number;
	losses: number;
	ties: number;
}

export interface PairRecord {
	a: number;
	b: number;
	together: Tally;
	against: Tally;
}

export interface Meeting {
	code: string;
	event: string;
	start: string;
	key: string;
	label: string;
	red: number[];
	blue: number[];
	redScore: number;
	blueScore: number;
	winner: AllianceColor | null;
}

export interface SharedEventCell {
	attending: boolean;
	rank: number | null;
	record: string | null;
	opr: number | null;
	awards: string[];
}

export interface SharedEvent {
	code: string;
	name: string;
	start: string;
	cells: SharedEventCell[];
}

export interface Comparison {
	teams: CompareTeam[];
	rows: CompareRow[];
	pairs: PairRecord[];
	meetings: Meeting[];
	shared: SharedEvent[];
	source: 'ratings' | 'scout' | null;
}

export interface CompareInput {
	seasons: TeamSeason[];
	ratings: SeasonRatings | null;
	bundles: Record<string, Pick<EventBundle, 'matches'> | null>;
}

export function parseTeamList(...values: (string | null | undefined)[]): number[] {
	const numbers: number[] = [];
	for (const value of values) {
		for (const part of (value ?? '').split(/[\s,+]+/)) {
			if (!/^\d{1,6}$/.test(part)) continue;
			const number = Number(part);
			if (number > 0 && !numbers.includes(number)) numbers.push(number);
		}
	}
	return numbers.slice(0, MAX_COMPARE);
}

export function compareHref(numbers: number[]): string {
	return numbers.length > 0 ? `/compare?teams=${numbers.join(',')}` : '/compare';
}

type Direction = 'high' | 'low' | null;

const percent = (value: number) => `${Math.round(value * 100)}%`;

function bestOf(
	values: (number | null)[],
	show: (value: number) => string,
	direction: Direction
): number[] {
	if (!direction) return [];
	const present = values.filter((value): value is number => value !== null);
	if (present.length < 2) return [];
	const top = show(direction === 'high' ? Math.max(...present) : Math.min(...present));
	if (present.every((value) => show(value) === top)) return [];
	return values.flatMap((value, index) => (value !== null && show(value) === top ? [index] : []));
}

function row(
	key: string,
	label: string,
	values: (number | null)[],
	show: (value: number) => string,
	direction: Direction,
	nested = false
): CompareRow {
	return {
		key,
		label,
		values: values.map((value) => (value === null ? MISSING : show(value))),
		best: bestOf(values, show, direction),
		nested
	};
}

function played(season: TeamSeason): TeamSeasonEvent[] {
	return season.events.filter((entry) => entry.stats !== null && entry.stats.played > 0);
}

function totals(season: TeamSeason): Tally | null {
	const list = played(season);
	if (list.length === 0) return null;
	return list.reduce<Tally>(
		(sum, entry) => ({
			wins: sum.wins + (entry.stats?.wins ?? 0),
			losses: sum.losses + (entry.stats?.losses ?? 0),
			ties: sum.ties + (entry.stats?.ties ?? 0)
		}),
		{ wins: 0, losses: 0, ties: 0 }
	);
}

function winRate(tally: Tally | null): number | null {
	if (!tally) return null;
	const games = tally.wins + tally.losses + tally.ties;
	return games > 0 ? tally.wins / games : null;
}

function awardsOf(season: TeamSeason, ids: number[] | null): number {
	return season.events.reduce(
		(sum, entry) =>
			sum +
			entry.awards.filter((award) =>
				ids ? ids.includes(award.id) : ![WINNING_ALLIANCE, FINALIST_ALLIANCE].includes(award.id)
			).length,
		0
	);
}

function seasonRows(seasons: TeamSeason[], ratings: SeasonRatings | null): CompareRow[] {
	const pool = ratedTeams(ratings);
	const rated = seasons.map((season) => pool.find((entry) => entry.team === season.team.number));
	const anyRated = rated.some(Boolean);
	const quick = seasons.map((season) => season.quickStats);
	const rankOf = (mine: SeasonRating) => 1 + pool.filter((entry) => entry.opr > mine.opr).length;
	const ratingRows = anyRated
		? [
				row(
					'opr',
					'Season OPR',
					rated.map((r) => r?.opr ?? null),
					fixed,
					'high'
				),
				row(
					'rank',
					'World rank by OPR',
					rated.map((r) => (r ? rankOf(r) : null)),
					integer,
					'low'
				),
				row(
					'auto',
					PART_LABELS.auto,
					rated.map((r) => r?.parts.auto ?? null),
					fixed,
					'high'
				),
				row(
					'teleop',
					PART_LABELS.teleop,
					rated.map((r) => (r ? r.opr - r.parts.auto : null)),
					fixed,
					'high'
				),
				row(
					'hive',
					PART_LABELS.hive,
					rated.map((r) => r?.parts.hive ?? null),
					fixed,
					'high',
					true
				),
				row(
					'flower',
					PART_LABELS.flower,
					rated.map((r) => r?.parts.flower ?? null),
					fixed,
					'high',
					true
				),
				row(
					'garden',
					PART_LABELS.garden,
					rated.map((r) => r?.parts.garden ?? null),
					fixed,
					'high',
					true
				),
				row(
					'park',
					PART_LABELS.park,
					rated.map((r) => r?.parts.park ?? null),
					fixed,
					'high',
					true
				),
				row(
					'tips',
					PART_LABELS.tips,
					rated.map((r) => r?.parts.tips ?? null),
					fixed,
					'high',
					true
				)
			]
		: quick.some(Boolean)
			? [
					row(
						'opr',
						'Best event OPR',
						quick.map((q) => q?.total.value ?? null),
						fixed,
						'high'
					),
					row(
						'rank',
						'World rank',
						quick.map((q) => q?.total.rank ?? null),
						integer,
						'low'
					),
					row(
						'auto',
						PART_LABELS.auto,
						quick.map((q) => q?.auto.value ?? null),
						fixed,
						'high'
					),
					row(
						'teleop',
						PART_LABELS.teleop,
						quick.map((q) => q?.teleop.value ?? null),
						fixed,
						'high'
					)
				]
			: [];
	const tallies = seasons.map(totals);
	const bestRanks = seasons.map((season) => {
		const ranks = played(season).flatMap((entry) =>
			entry.stats && entry.stats.rank > 0 ? [entry.stats.rank] : []
		);
		return ranks.length > 0 ? Math.min(...ranks) : null;
	});
	return [
		...ratingRows,
		{
			key: 'record',
			label: 'Record',
			values: tallies.map((t) => (t ? record(t.wins, t.losses, t.ties) : MISSING)),
			best: bestOf(tallies.map(winRate), percent, 'high'),
			nested: false
		},
		row('winrate', 'Win rate', tallies.map(winRate), percent, 'high'),
		row(
			'events',
			'Events played',
			seasons.map((s) => played(s).length),
			integer,
			null
		),
		row('bestRank', 'Best event rank', bestRanks, integer, 'low'),
		row(
			'eventWins',
			'Event wins',
			seasons.map((s) => awardsOf(s, [WINNING_ALLIANCE])),
			integer,
			'high'
		),
		row(
			'awards',
			'Judged awards',
			seasons.map((s) => awardsOf(s, null)),
			integer,
			'high'
		)
	];
}

function onField(match: Match, color: AllianceColor): number[] {
	return match[color].filter((team) => team.onField && !team.noShow).map((team) => team.team);
}

function emptyTally(): Tally {
	return { wins: 0, losses: 0, ties: 0 };
}

function headToHead(
	numbers: number[],
	shared: SharedEvent[],
	bundles: CompareInput['bundles']
): { pairs: PairRecord[]; meetings: Meeting[] } {
	const pairs: PairRecord[] = [];
	for (let i = 0; i < numbers.length; i++)
		for (let j = i + 1; j < numbers.length; j++)
			pairs.push({ a: numbers[i], b: numbers[j], together: emptyTally(), against: emptyTally() });
	const meetings: Meeting[] = [];
	for (const event of [...shared].sort((x, y) => x.start.localeCompare(y.start))) {
		for (const match of bundles[event.code]?.matches ?? []) {
			const result = match.result;
			if (!result) continue;
			const red = onField(match, 'red');
			const blue = onField(match, 'blue');
			const present = numbers.filter((team) => red.includes(team) || blue.includes(team));
			if (present.length < 2) continue;
			meetings.push({
				code: event.code,
				event: event.name,
				start: event.start,
				key: match.key,
				label: match.label,
				red,
				blue,
				redScore: result.red.total,
				blueScore: result.blue.total,
				winner: result.winner
			});
			for (const pair of pairs) {
				const aRed = red.includes(pair.a);
				const bRed = red.includes(pair.b);
				const aIn = aRed || blue.includes(pair.a);
				const bIn = bRed || blue.includes(pair.b);
				if (!aIn || !bIn) continue;
				const aColor: AllianceColor = aRed ? 'red' : 'blue';
				const tally = aRed === bRed ? pair.together : pair.against;
				if (result.winner === null) tally.ties += 1;
				else if (result.winner === aColor) tally.wins += 1;
				else tally.losses += 1;
			}
		}
	}
	return { pairs, meetings };
}

function sharedEvents(seasons: TeamSeason[]): SharedEvent[] {
	const byCode = new Map<
		string,
		{ name: string; start: string; entries: (TeamSeasonEvent | null)[] }
	>();
	seasons.forEach((season, index) => {
		for (const entry of season.events) {
			const found = byCode.get(entry.event.code) ?? {
				name: entry.event.name,
				start: entry.event.start,
				entries: seasons.map(() => null)
			};
			found.entries[index] = entry;
			byCode.set(entry.event.code, found);
		}
	});
	return [...byCode]
		.filter(([, value]) => value.entries.filter(Boolean).length >= 2)
		.map(([code, value]) => ({
			code,
			name: value.name,
			start: value.start,
			cells: value.entries.map((entry) => ({
				attending: entry !== null,
				rank: entry?.stats && entry.stats.rank > 0 ? entry.stats.rank : null,
				record: entry?.stats
					? record(entry.stats.wins, entry.stats.losses, entry.stats.ties)
					: null,
				opr: entry?.stats ? entry.stats.opr.total : null,
				awards: entry ? entry.awards.map(awardLabel) : []
			}))
		}))
		.sort((a, b) => b.start.localeCompare(a.start) || a.name.localeCompare(b.name));
}

export function sharedEventCodes(seasons: TeamSeason[]): string[] {
	return sharedEvents(seasons)
		.filter((event) => event.cells.filter((cell) => cell.record !== null).length >= 2)
		.slice(0, MAX_SHARED_EVENTS)
		.map((event) => event.code);
}

export function buildComparison(input: CompareInput): Comparison {
	const { seasons, ratings, bundles } = input;
	const numbers = seasons.map((season) => season.team.number);
	const shared = sharedEvents(seasons);
	const { pairs, meetings } = headToHead(numbers, shared, bundles);
	const pool = ratedTeams(ratings);
	const anyRated = numbers.some((number) => pool.some((entry) => entry.team === number));
	return {
		teams: seasons.map((season) => ({
			number: season.team.number,
			name: season.team.name,
			place: placeName(season.team, 'short')
		})),
		rows: seasons.length > 0 ? seasonRows(seasons, ratings) : [],
		pairs,
		meetings,
		shared,
		source: anyRated ? 'ratings' : seasons.some((s) => s.quickStats) ? 'scout' : null
	};
}

export function suggestNeighbors(
	ratings: SeasonRatings | null,
	numbers: number[],
	count = 3
): number[] {
	const pool = ratedTeams(ratings);
	const index = Math.max(
		0,
		pool.findIndex((entry) => numbers.includes(entry.team))
	);
	return pool
		.map((entry, at) => ({ team: entry.team, distance: Math.abs(at - index) }))
		.filter((entry) => !numbers.includes(entry.team))
		.sort((a, b) => a.distance - b.distance)
		.slice(0, count)
		.map((entry) => entry.team);
}
