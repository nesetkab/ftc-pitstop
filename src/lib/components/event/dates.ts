export type EventStatus = 'live' | 'upcoming' | 'done';

type Dated = { start: string; end: string; timezone: string };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
	let format = formatters.get(timeZone);
	if (!format) {
		try {
			format = new Intl.DateTimeFormat('en-US', {
				timeZone,
				year: 'numeric',
				month: '2-digit',
				day: '2-digit'
			});
		} catch {
			format = formatter('UTC');
		}
		formatters.set(timeZone, format);
	}
	return format;
}

export function localDate(time: number, timeZone: string): string {
	const parts = formatter(timeZone).formatToParts(new Date(time));
	const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
	return `${value('year')}-${value('month')}-${value('day')}`;
}

export function addDays(date: string, days: number): string {
	const day = new Date(`${date}T00:00:00Z`);
	day.setUTCDate(day.getUTCDate() + days);
	return day.toISOString().slice(0, 10);
}

export function weekStart(date: string): string {
	const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
	return addDays(date, -((weekday + 6) % 7));
}

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
