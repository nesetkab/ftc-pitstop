import { localDate } from '#lib/format/calendar.ts';
import { fixed, integer } from '#lib/format/number.ts';
import { ordinal } from '#lib/format/ordinal.ts';
import type { SeasonRatings } from '#lib/analysis/types.ts';
import type { EventSummary } from '#lib/types.ts';
import { eventStatus } from './dates.ts';
import type { ListedEvent } from './event-list.ts';

export const TOP = 8;
export const DEEP = 24;

export type Roster = { registered: number[]; played: number[] };

export type Rosters = Record<string, Roster>;

export type StrengthEntry = [
	top: number | null,
	deep: number | null,
	all: number,
	rated: number,
	teams: number
];

export type StrengthIndex = { ratingsAt: number; events: Record<string, StrengthEntry> };

export type EventStrength = {
	top: number | null;
	deep: number | null;
	all: number;
	rated: number;
	teams: number;
	rank: number | null;
};

export type RankedStrength = {
	ratingsAt: number;
	total: number;
	events: Map<string, EventStrength>;
};

export type StrengthDetail = [deep: number | null, all: number, rated: number];

export type StrengthBy = 'top' | 'deep' | 'all';

export type StrengthWhen = 'upcoming' | 'past' | 'all';

export type StrengthFilters = { region: string; type: string; when: StrengthWhen; by: StrengthBy };

export type StrengthRow = ListedEvent & {
	top: number;
	deep: number | null;
	all: number;
	rated: number;
};

function round(value: number): number {
	return Math.round(value * 10) / 10;
}

function mean(values: number[]): number {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function rosterFor(
	event: Pick<EventSummary, 'end' | 'timezone'>,
	roster: Roster | undefined,
	now: number
): number[] {
	if (!roster) return [];
	const over = event.end < localDate(now, event.timezone);
	return over && roster.played.length > 0 ? roster.played : roster.registered;
}

export function seasonOprs(ratings: SeasonRatings): Map<number, number> {
	return new Map(
		ratings.teams
			.filter((rating) => rating.matches > 0 && Number.isFinite(rating.opr))
			.map((rating) => [rating.team, rating.opr])
	);
}

export function measure(teams: number[], oprs: ReadonlyMap<number, number>): StrengthEntry | null {
	const unique = [...new Set(teams)];
	const rated = unique
		.flatMap((team) => {
			const opr = oprs.get(team);
			return opr === undefined ? [] : [opr];
		})
		.sort((a, b) => b - a);
	if (rated.length === 0) return null;
	return [
		rated.length >= TOP ? round(mean(rated.slice(0, TOP))) : null,
		rated.length >= DEEP ? round(mean(rated.slice(0, DEEP))) : null,
		round(mean(rated)),
		rated.length,
		unique.length
	];
}

export function buildStrengthIndex(input: {
	events: EventSummary[];
	rosters: Rosters;
	ratings: SeasonRatings;
	now: number;
}): StrengthIndex {
	const oprs = seasonOprs(input.ratings);
	const events: Record<string, StrengthEntry> = {};
	for (const event of input.events) {
		const entry = measure(rosterFor(event, input.rosters[event.code], input.now), oprs);
		if (entry) events[event.code] = entry;
	}
	return { ratingsAt: input.ratings.generatedAt, events };
}

export function rankStrength(index: StrengthIndex): RankedStrength {
	const ranked = Object.entries(index.events)
		.flatMap(([code, entry]) => (entry[0] === null ? [] : [{ code, top: entry[0] }]))
		.sort((a, b) => b.top - a.top || a.code.localeCompare(b.code));
	const ranks = new Map<string, number>();
	ranked.forEach((item, at) => {
		const previous = ranked[at - 1];
		ranks.set(item.code, previous?.top === item.top ? ranks.get(previous.code)! : at + 1);
	});
	const events = new Map<string, EventStrength>();
	for (const [code, [top, deep, all, rated, teams]] of Object.entries(index.events)) {
		events.set(code, { top, deep, all, rated, teams, rank: ranks.get(code) ?? null });
	}
	return { ratingsAt: index.ratingsAt, total: ranked.length, events };
}

export type EventRank = { rank: number; top: number; total: number };

export function eventRank(ranked: RankedStrength | null, code: string): EventRank | null {
	const entry = ranked?.events.get(code);
	if (!ranked || !entry || entry.rank === null || entry.top === null) return null;
	return { rank: entry.rank, top: entry.top, total: ranked.total };
}

export function strengthLine({ rank, top, total }: EventRank): string {
	return `${ordinal(rank)} of ${integer(total)} events this season (top-${TOP} avg OPR ${fixed(top)})`;
}

export function strengthDetail(strength: EventStrength): StrengthDetail {
	return [strength.deep, strength.all, strength.rated];
}

export function strengthRows(events: ListedEvent[], details: StrengthDetail[]): StrengthRow[] {
	return events.flatMap((event, at) => {
		const detail = details[at];
		if (event.strength === null || !detail) return [];
		const [deep, all, rated] = detail;
		return [{ ...event, top: event.strength, deep, all, rated }];
	});
}

function score(row: StrengthRow, by: StrengthBy): number | null {
	return by === 'top' ? row.top : by === 'deep' ? row.deep : row.all;
}

export function filterStrength(
	rows: StrengthRow[],
	filters: StrengthFilters,
	now: number
): StrengthRow[] {
	return rows
		.filter((row) => {
			if (filters.region && row.region !== filters.region) return false;
			if (filters.type && row.type !== filters.type) return false;
			if (score(row, filters.by) === null) return false;
			const done = eventStatus(row, now) === 'done';
			if (filters.when === 'upcoming' && done) return false;
			if (filters.when === 'past' && !done) return false;
			return true;
		})
		.sort(
			(a, b) =>
				score(b, filters.by)! - score(a, filters.by)! ||
				b.top - a.top ||
				a.name.localeCompare(b.name)
		);
}
