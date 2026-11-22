import { addDays, isValidTimeZone, timeZoneOffset } from '#lib/server/time.ts';

export type IcsTime = { date: string } | { at: number; timeZone: string };

export interface IcsEvent {
	uid: string;
	summary: string;
	start: IcsTime;
	end: IcsTime;
	description?: string;
	location?: string;
	url?: string;
	transparent?: boolean;
	categories?: string[];
}

export interface IcsCalendar {
	name: string;
	description?: string;
	timeZone?: string;
	refreshMinutes: number;
	stamp: number;
	events: IcsEvent[];
}

const MINUTE = 60_000;
const DAY = 86_400_000;
const MAX_OCTETS = 75;
const encoder = new TextEncoder();

export function escapeText(text: string): string {
	return text
		.replaceAll('\\', '\\\\')
		.replaceAll(';', '\\;')
		.replaceAll(',', '\\,')
		.replace(/\r\n?|\n/g, '\\n');
}

export function foldLine(line: string): string {
	const parts: string[] = [];
	let current = '';
	let size = 0;
	for (const char of line) {
		const bytes = encoder.encode(char).length;
		const limit = parts.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
		if (size + bytes > limit) {
			parts.push(current);
			current = '';
			size = 0;
		}
		current += char;
		size += bytes;
	}
	parts.push(current);
	return parts.join('\r\n ');
}

function pad(value: number, width = 2): string {
	return String(value).padStart(width, '0');
}

function stamp(instant: number): string {
	const date = new Date(instant);
	return `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

export function utcStamp(instant: number): string {
	return `${stamp(instant)}Z`;
}

export function localStamp(instant: number, timeZone: string): string {
	return stamp(instant + timeZoneOffset(instant, timeZone));
}

function dateValue(date: string): string {
	return date.slice(0, 10).replaceAll('-', '');
}

function offsetText(ms: number): string {
	const sign = ms < 0 ? '-' : '+';
	const seconds = Math.round(Math.abs(ms) / 1000);
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const rest = seconds % 60;
	return `${sign}${pad(hours)}${pad(minutes)}${rest ? pad(rest) : ''}`;
}

function zoned(timeZone: string): boolean {
	return timeZone !== 'UTC' && isValidTimeZone(timeZone);
}

function timeProperty(name: string, value: IcsTime): string {
	if ('date' in value) return `${name};VALUE=DATE:${dateValue(value.date)}`;
	if (zoned(value.timeZone)) {
		return `${name};TZID=${value.timeZone}:${localStamp(value.at, value.timeZone)}`;
	}
	return `${name}:${utcStamp(value.at)}`;
}

export function transitions(timeZone: string, from: number, to: number) {
	const found: { at: number; from: number; to: number }[] = [];
	let at = from;
	let offset = timeZoneOffset(at, timeZone);
	while (at < to) {
		const next = Math.min(at + DAY, to);
		const nextOffset = timeZoneOffset(next, timeZone);
		if (nextOffset !== offset) {
			let low = at;
			let high = next;
			while (high - low > 1000) {
				const mid = Math.floor((low + high) / 2);
				if (timeZoneOffset(mid, timeZone) === offset) low = mid;
				else high = mid;
			}
			found.push({ at: Math.floor(high / MINUTE) * MINUTE, from: offset, to: nextOffset });
			offset = nextOffset;
		}
		at = next;
	}
	return found;
}

function standardOffset(timeZone: string, instant: number): number {
	const year = new Date(instant).getUTCFullYear();
	return Math.min(
		timeZoneOffset(Date.UTC(year, 0, 1), timeZone),
		timeZoneOffset(Date.UTC(year, 6, 1), timeZone)
	);
}

function observance(kind: 'STANDARD' | 'DAYLIGHT', start: string, from: number, to: number) {
	return [
		`BEGIN:${kind}`,
		`DTSTART:${start}`,
		`TZOFFSETFROM:${offsetText(from)}`,
		`TZOFFSETTO:${offsetText(to)}`,
		`END:${kind}`
	];
}

export function vtimezone(timeZone: string, from: number, to: number): string[] {
	const first = from - DAY;
	const initial = timeZoneOffset(first, timeZone);
	const standard = standardOffset(timeZone, from);
	const kind = (offset: number) => (offset > standard ? 'DAYLIGHT' : 'STANDARD');
	const lines = [
		'BEGIN:VTIMEZONE',
		`TZID:${timeZone}`,
		...observance(kind(initial), '19700101T000000', initial, initial)
	];
	for (const change of transitions(timeZone, first, to + DAY)) {
		lines.push(
			...observance(kind(change.to), stamp(change.at + change.from), change.from, change.to)
		);
	}
	lines.push('END:VTIMEZONE');
	return lines;
}

function zoneRanges(events: IcsEvent[]): Map<string, { from: number; to: number }> {
	const ranges = new Map<string, { from: number; to: number }>();
	for (const event of events) {
		for (const value of [event.start, event.end]) {
			if ('date' in value || !zoned(value.timeZone)) continue;
			const range = ranges.get(value.timeZone);
			if (!range) ranges.set(value.timeZone, { from: value.at, to: value.at });
			else {
				range.from = Math.min(range.from, value.at);
				range.to = Math.max(range.to, value.at);
			}
		}
	}
	return ranges;
}

function eventLines(event: IcsEvent, dtstamp: string): string[] {
	const lines = [
		'BEGIN:VEVENT',
		`UID:${event.uid}`,
		`DTSTAMP:${dtstamp}`,
		timeProperty('DTSTART', event.start),
		timeProperty('DTEND', event.end),
		`SUMMARY:${escapeText(event.summary)}`
	];
	if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
	if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
	if (event.url) lines.push(`URL:${event.url.replace(/[\r\n]/g, '')}`);
	if (event.categories?.length) {
		lines.push(`CATEGORIES:${event.categories.map(escapeText).join(',')}`);
	}
	lines.push(`TRANSP:${event.transparent ? 'TRANSPARENT' : 'OPAQUE'}`);
	lines.push('END:VEVENT');
	return lines;
}

export function allDay(start: string, end: string): { start: IcsTime; end: IcsTime } {
	return { start: { date: start }, end: { date: addDays(end < start ? start : end, 1) } };
}

export function renderCalendar(calendar: IcsCalendar): string {
	const dtstamp = utcStamp(calendar.stamp);
	const refresh = `PT${Math.max(1, Math.round(calendar.refreshMinutes))}M`;
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//PitStop//FTC calendar//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(calendar.name)}`,
		`NAME:${escapeText(calendar.name)}`
	];
	if (calendar.description) {
		lines.push(`X-WR-CALDESC:${escapeText(calendar.description)}`);
		lines.push(`DESCRIPTION:${escapeText(calendar.description)}`);
	}
	if (calendar.timeZone && zoned(calendar.timeZone)) {
		lines.push(`X-WR-TIMEZONE:${calendar.timeZone}`);
	}
	lines.push(`REFRESH-INTERVAL;VALUE=DURATION:${refresh}`, `X-PUBLISHED-TTL:${refresh}`);
	for (const [timeZone, range] of zoneRanges(calendar.events)) {
		lines.push(...vtimezone(timeZone, range.from, range.to));
	}
	for (const event of calendar.events) lines.push(...eventLines(event, dtstamp));
	lines.push('END:VCALENDAR');
	return lines.map(foldLine).join('\r\n') + '\r\n';
}
