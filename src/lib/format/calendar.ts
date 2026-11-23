const DAY_MS = 86_400_000;

const LOCAL_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
	let format = formatters.get(timeZone);
	if (!format) {
		format = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		formatters.set(timeZone, format);
	}
	return format;
}

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
	if (!timeZone) return false;
	try {
		formatter(timeZone);
		return true;
	} catch {
		return false;
	}
}

function wallClock(instant: number, timeZone: string) {
	const parts: Record<string, number> = {};
	for (const part of formatter(timeZone).formatToParts(new Date(instant))) {
		if (part.type !== 'literal') parts[part.type] = Number(part.value);
	}
	return parts as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
}

export function timeZoneOffset(instant: number, timeZone: string): number {
	const { year, month, day, hour, minute, second } = wallClock(instant, timeZone);
	const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
	return asUtc - (instant - (((instant % 1000) + 1000) % 1000));
}

export function zonedTimeToUtc(local: string, timeZone: string): number | null {
	const match = LOCAL_TIME.exec(local.trim());
	if (!match) {
		const parsed = Date.parse(local);
		return Number.isNaN(parsed) ? null : parsed;
	}
	const [, year, month, day, hour = '0', minute = '0', second = '0', fraction = ''] = match;
	const millis = Number(fraction.slice(0, 3).padEnd(3, '0'));
	const naive = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second, millis);
	if (!isValidTimeZone(timeZone)) return naive;

	const before = timeZoneOffset(naive - DAY_MS, timeZone);
	const after = timeZoneOffset(naive + DAY_MS, timeZone);
	const candidates = [naive - before, naive - after].filter(
		(instant) => timeZoneOffset(instant, timeZone) === naive - instant
	);
	if (candidates.length > 0) return Math.min(...candidates);
	return naive - before;
}

export function localDate(instant: number, timeZone: string | null | undefined): string {
	const { year, month, day } = wallClock(instant, isValidTimeZone(timeZone) ? timeZone : 'UTC');
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function startOfLocalDay(date: string, timeZone: string): number | null {
	return zonedTimeToUtc(`${date.slice(0, 10)}T00:00:00`, timeZone);
}

function serial(date: string): number {
	const [year, month, day] = date.slice(0, 10).split('-').map(Number);
	return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function addDays(date: string, days: number): string {
	return new Date((serial(date) + days) * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
	return serial(to) - serial(from);
}

export function weekStart(date: string): string {
	const weekday = new Date(serial(date) * DAY_MS).getUTCDay();
	return addDays(date, -((weekday + 6) % 7));
}
