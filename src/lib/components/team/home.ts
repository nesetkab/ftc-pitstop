import { isCompetition } from '#lib/game/event-types.ts';
import type { EventSummary } from '#lib/types.ts';
import { addDays, daysBetween, localDay, shortRange } from './dates.ts';
import { placeName } from '#lib/format/places.ts';

export interface HomeEvent {
	code: string;
	name: string;
	type: string;
	place: string;
	dates: string;
	status: string;
}

export interface HomeEvents {
	today: HomeEvent[] | null;
	week: HomeEvent[] | null;
}

const WEEK_DAYS = 7;

function row(event: EventSummary, dates: string, status: string): HomeEvent {
	return {
		code: event.code,
		name: event.name,
		type: event.typeName,
		place: placeName(event, 'short'),
		dates,
		status
	};
}

function byName(a: EventSummary, b: EventSummary): number {
	return a.name.localeCompare(b.name);
}

function todayRow(event: EventSummary, now: number): HomeEvent {
	const length = daysBetween(event.start, event.end) + 1;
	const day = daysBetween(event.start, localDay(now, event.timezone)) + 1;
	return row(
		event,
		length > 1 ? `Day ${day} of ${length}` : 'Today',
		event.hasMatches ? 'Matches posted' : 'No matches posted'
	);
}

function weekRow(event: EventSummary, now: number): HomeEvent {
	const until = daysBetween(localDay(now, event.timezone), event.start);
	return row(
		event,
		shortRange(event.start, event.end),
		until <= 1 ? 'Tomorrow' : `In ${until} days`
	);
}

export function buildHomeEvents(
	input: { today: EventSummary[] | null; season: EventSummary[] | null },
	now: number
): HomeEvents {
	const today = input.today
		? input.today
				.filter((event) => isCompetition(event.type))
				.sort(
					(a, b) => Number(Boolean(b.hasMatches)) - Number(Boolean(a.hasMatches)) || byName(a, b)
				)
				.map((event) => todayRow(event, now))
		: null;

	const week = input.season
		? input.season
				.filter((event) => {
					if (!isCompetition(event.type)) return false;
					const day = localDay(now, event.timezone);
					return event.start > day && event.start <= addDays(day, WEEK_DAYS);
				})
				.sort((a, b) => a.start.localeCompare(b.start) || byName(a, b))
				.map((event) => weekRow(event, now))
		: null;

	return { today, week };
}
