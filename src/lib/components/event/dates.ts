import { localDate } from '#lib/format/calendar.ts';

export { addDays, weekStart } from '#lib/format/calendar.ts';

export type EventStatus = 'live' | 'upcoming' | 'done';

type Dated = { start: string; end: string; timezone: string };

export function eventStatus(event: Dated, now: number): EventStatus {
	const today = localDate(now, event.timezone);
	if (today < event.start) return 'upcoming';
	if (today > event.end) return 'done';
	return 'live';
}

export function isMultiDay(event: Pick<Dated, 'start' | 'end'>): boolean {
	return event.end > event.start;
}

const weekdays = new Map<string, Intl.DateTimeFormat>();

export function weekday(time: number, timeZone: string): string {
	let format = weekdays.get(timeZone);
	if (!format) {
		format = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone });
		weekdays.set(timeZone, format);
	}
	return format.format(new Date(time));
}
