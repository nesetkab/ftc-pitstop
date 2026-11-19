import { isCompetition } from '#lib/game/event-types.ts';
import type { EventSummary } from '#lib/types.ts';

export type EventPickReason = 'today' | 'next' | 'last';

export interface EventPick {
	event: EventSummary;
	reason: EventPickReason;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
	let format = formatters.get(timeZone);
	if (!format) {
		const options = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
		try {
			format = new Intl.DateTimeFormat('en-US', { ...options, timeZone });
		} catch {
			format = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
		}
		formatters.set(timeZone, format);
	}
	return format;
}

export function localDay(instant: number, timeZone: string): string {
	const parts = formatter(timeZone).formatToParts(new Date(instant));
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value ?? '';
	return `${part('year')}-${part('month')}-${part('day')}`;
}

export function pickEvent(events: EventSummary[], now: number): EventPick | null {
	const competitions = events.filter((event) => isCompetition(event.type));
	const today = (event: EventSummary) => localDay(now, event.timezone);
	const live = competitions
		.filter((event) => event.start <= today(event) && today(event) <= event.end)
		.sort((a, b) => b.start.localeCompare(a.start));
	if (live.length > 0) return { event: live[0], reason: 'today' };
	const upcoming = competitions
		.filter((event) => event.start > today(event))
		.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
	if (upcoming.length > 0) return { event: upcoming[0], reason: 'next' };
	const past = competitions
		.filter((event) => event.end < today(event))
		.sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
	if (past.length > 0) return { event: past[0], reason: 'last' };
	return null;
}
