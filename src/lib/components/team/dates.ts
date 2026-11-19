import { shortDate } from '#lib/format/index.ts';

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
	let format = formatters.get(timeZone);
	if (!format) {
		format = new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
		formatters.set(timeZone, format);
	}
	return format;
}

export function localDay(instant: number, timeZone: string | null | undefined): string {
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = formatter(timeZone || 'UTC').formatToParts(instant);
	} catch {
		parts = formatter('UTC').formatToParts(instant);
	}
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? '';
	return `${value('year')}-${value('month')}-${value('day')}`;
}

function serial(day: string): number {
	const [year, month, date] = day.slice(0, 10).split('-').map(Number);
	return Date.UTC(year, month - 1, date) / DAY_MS;
}

export function daysBetween(from: string, to: string): number {
	return serial(to) - serial(from);
}

export function addDays(day: string, days: number): string {
	return new Date((serial(day) + days) * DAY_MS).toISOString().slice(0, 10);
}

export function shortRange(start: string, end: string): string {
	const length = daysBetween(start, end);
	if (length <= 0) return shortDate(start);
	const sameMonth = start.slice(5, 7) === end.slice(5, 7);
	const last = sameMonth ? String(Number(end.slice(8, 10))) : shortDate(end);
	return `${shortDate(start)} ${length === 1 ? 'and' : 'to'} ${last}`;
}
