export type DateInput = Date | string | number;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function isDateOnly(input: DateInput): input is string {
	return typeof input === 'string' && DATE_ONLY.test(input);
}

export function toDate(input: DateInput): Date {
	if (input instanceof Date) return input;
	if (isDateOnly(input)) return new Date(`${input}T00:00:00Z`);
	return new Date(input);
}

function formatter(options: Intl.DateTimeFormatOptions, timeZone?: string): Intl.DateTimeFormat {
	const key = JSON.stringify([options, timeZone ?? '']);
	let format = formatters.get(key);
	if (!format) {
		format = new Intl.DateTimeFormat('en-US', { ...options, timeZone });
		formatters.set(key, format);
	}
	return format;
}

function format(input: DateInput, options: Intl.DateTimeFormatOptions, timeZone?: string) {
	return formatter(options, isDateOnly(input) ? 'UTC' : timeZone).format(toDate(input));
}

function keepMeridiemTogether(text: string): string {
	return text.replace(/\s+(?=[AP]M\b)/, ' ');
}

export function time(input: DateInput, timeZone?: string): string {
	return keepMeridiemTogether(format(input, { hour: 'numeric', minute: '2-digit' }, timeZone));
}

export function timeWithSeconds(input: DateInput, timeZone?: string): string {
	return keepMeridiemTogether(
		format(input, { hour: 'numeric', minute: '2-digit', second: '2-digit' }, timeZone)
	);
}

export function longDate(input: DateInput, timeZone?: string): string {
	return format(
		input,
		{ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
		timeZone
	);
}

export function shortDate(input: DateInput, timeZone?: string): string {
	return format(input, { month: 'short', day: 'numeric' }, timeZone);
}

function calendarDay(input: DateInput, timeZone?: string) {
	const zone = isDateOnly(input) ? 'UTC' : timeZone;
	const date = toDate(input);
	const parts = formatter(
		{ year: 'numeric', month: 'numeric', day: 'numeric' },
		zone
	).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value);
	const year = value('year');
	const month = value('month');
	const day = value('day');
	return {
		year,
		month,
		day,
		monthName: formatter({ month: 'long' }, zone).format(date),
		serial: Date.UTC(year, month - 1, day) / DAY_MS
	};
}

export function dateRange(start: DateInput, end: DateInput, timeZone?: string): string {
	const first = calendarDay(start, timeZone);
	const last = calendarDay(end, timeZone);
	if (last.serial <= first.serial) return longDate(start, timeZone);
	const joiner = last.serial - first.serial === 1 ? 'and' : 'to';
	if (first.year !== last.year) {
		return `${first.monthName} ${first.day}, ${first.year} ${joiner} ${last.monthName} ${last.day}, ${last.year}`;
	}
	if (first.month !== last.month) {
		return `${first.monthName} ${first.day} ${joiner} ${last.monthName} ${last.day}, ${last.year}`;
	}
	return `${first.monthName} ${first.day} ${joiner} ${last.day}, ${last.year}`;
}
