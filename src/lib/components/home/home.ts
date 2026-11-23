import {
	compareToday,
	todayState,
	type EventLeader,
	type EventProgress,
	type TodayState
} from './today.ts';
import { placeName } from '#lib/format/places.ts';
import { isCompetition } from '#lib/game/event-types.ts';
import type { EventSummary } from '#lib/types.ts';
import { shortRange } from '#lib/format/time.ts';
import { addDays, daysBetween, localDate } from '#lib/format/calendar.ts';

export interface HomeEvent {
	code: string;
	name: string;
	type: string;
	place: string;
	dates: string;
	status: string;
}

export interface TodayEvent extends HomeEvent {
	state: TodayState;
	leader: EventLeader | null;
	leaderLabel: string;
}

export interface HomeEvents {
	today: TodayEvent[] | null;
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

function todayRow(event: EventSummary, progress: EventProgress | null, now: number): TodayEvent {
	const length = daysBetween(event.start, event.end) + 1;
	const day = daysBetween(event.start, localDate(now, event.timezone)) + 1;
	const status = progress?.label ?? (event.hasMatches ? 'Matches posted' : 'Not started');
	return {
		...row(event, length > 1 ? `Day ${day} of ${length}` : 'Today', status),
		state: todayState(progress, event.hasMatches),
		leader: progress?.leader ?? null,
		leaderLabel: progress?.phase === 'quals' ? 'Leading' : 'Top seed'
	};
}

function weekRow(event: EventSummary, now: number): HomeEvent {
	const until = daysBetween(localDate(now, event.timezone), event.start);
	return row(
		event,
		shortRange(event.start, event.end),
		until <= 1 ? 'Tomorrow' : `In ${until} days`
	);
}

export function todayCompetitions(events: EventSummary[]): EventSummary[] {
	return events.filter((event) => isCompetition(event.type));
}

export function buildHomeEvents(
	input: {
		today: EventSummary[] | null;
		season: EventSummary[] | null;
		progress?: Record<string, EventProgress>;
	},
	now: number
): HomeEvents {
	const today = input.today
		? todayCompetitions(input.today)
				.map((event) => todayRow(event, input.progress?.[event.code] ?? null, now))
				.sort(compareToday)
		: null;

	const week = input.season
		? input.season
				.filter((event) => {
					if (!isCompetition(event.type)) return false;
					const day = localDate(now, event.timezone);
					return event.start > day && event.start <= addDays(day, WEEK_DAYS);
				})
				.sort((a, b) => a.start.localeCompare(b.start) || byName(a, b))
				.map((event) => weekRow(event, now))
		: null;

	return { today, week };
}
