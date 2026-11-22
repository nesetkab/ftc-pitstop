import { describe, expect, it } from 'vitest';
import {
	allDay,
	escapeText,
	foldLine,
	renderCalendar,
	transitions,
	type IcsEvent
} from '#lib/server/calendar/ics.ts';

const encoder = new TextEncoder();
const STAMP = Date.parse('2026-11-22T12:00:00Z');

function unfold(text: string): string[] {
	return text.replace(/\r\n /g, '').split('\r\n').filter(Boolean);
}

function render(events: IcsEvent[], timeZone?: string) {
	return renderCalendar({ name: 'Test', refreshMinutes: 15, stamp: STAMP, timeZone, events });
}

function match(uid: string, iso: string, timeZone: string): IcsEvent {
	const at = Date.parse(iso);
	return {
		uid,
		summary: uid,
		start: { at, timeZone },
		end: { at: at + 600_000, timeZone }
	};
}

describe('ics text', () => {
	it('escapes commas, semicolons, backslashes and newlines', () => {
		expect(escapeText('Red: 1, 2; blue\\gold\nnext\r\nline')).toBe(
			'Red: 1\\, 2\\; blue\\\\gold\\nnext\\nline'
		);
	});

	it('folds long lines at 75 octets without splitting characters', () => {
		const line = `DESCRIPTION:${'Pollinators – 🐝 bring flowers home, '.repeat(12)}`;
		const folded = foldLine(line);
		const parts = folded.split('\r\n');
		expect(parts.length).toBeGreaterThan(5);
		parts.forEach((part, index) => {
			expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
			if (index > 0) expect(part.startsWith(' ')).toBe(true);
			expect(part).not.toContain('�');
		});
		expect(folded.replace(/\r\n /g, '')).toBe(line);
	});

	it('leaves short lines alone', () => {
		expect(foldLine('SUMMARY:Q12')).toBe('SUMMARY:Q12');
	});
});

describe('ics calendar', () => {
	it('uses CRLF everywhere and ends with a line break', () => {
		const text = render([{ uid: 'a@x', summary: 'A', ...allDay('2026-11-20', '2026-11-21') }]);
		expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
		expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
		const lines = unfold(text);
		expect(lines[0]).toBe('BEGIN:VCALENDAR');
		expect(lines).toContain('VERSION:2.0');
		expect(lines).toContain('DTSTAMP:20261122T120000Z');
	});

	it('writes all-day events with an exclusive end date', () => {
		const lines = unfold(
			render([{ uid: 'a@x', summary: 'A', ...allDay('2026-11-20', '2026-11-21') }])
		);
		expect(lines).toContain('DTSTART;VALUE=DATE:20261120');
		expect(lines).toContain('DTEND;VALUE=DATE:20261122');
		expect(lines.some((line) => line.startsWith('BEGIN:VTIMEZONE'))).toBe(false);
	});

	it('keeps each uid as given', () => {
		const lines = unfold(
			render([
				match('2026-USMTBUQ-q1@ftcpitstop.com', '2026-11-21T18:00:00Z', 'America/Denver'),
				match('2026-USMTBUQ-q2@ftcpitstop.com', '2026-11-21T18:07:00Z', 'America/Denver')
			])
		);
		expect(lines.filter((line) => line.startsWith('UID:'))).toEqual([
			'UID:2026-USMTBUQ-q1@ftcpitstop.com',
			'UID:2026-USMTBUQ-q2@ftcpitstop.com'
		]);
	});

	it('writes local times in the event zone across the end of daylight time', () => {
		const lines = unfold(
			render(
				[
					match('sat@x', '2026-10-31T13:00:00Z', 'America/New_York'),
					match('sun@x', '2026-11-01T13:00:00Z', 'America/New_York')
				],
				'America/New_York'
			)
		);
		expect(lines).toContain('DTSTART;TZID=America/New_York:20261031T090000');
		expect(lines).toContain('DTSTART;TZID=America/New_York:20261101T080000');
		expect(lines).toContain('X-WR-TIMEZONE:America/New_York');
		const zone = lines.slice(lines.indexOf('BEGIN:VTIMEZONE'), lines.indexOf('END:VTIMEZONE') + 1);
		expect(zone).toEqual([
			'BEGIN:VTIMEZONE',
			'TZID:America/New_York',
			'BEGIN:DAYLIGHT',
			'DTSTART:19700101T000000',
			'TZOFFSETFROM:-0400',
			'TZOFFSETTO:-0400',
			'END:DAYLIGHT',
			'BEGIN:STANDARD',
			'DTSTART:20261101T020000',
			'TZOFFSETFROM:-0400',
			'TZOFFSETTO:-0500',
			'END:STANDARD',
			'END:VTIMEZONE'
		]);
	});

	it('finds the exact minute a zone changes offset', () => {
		const from = Date.parse('2027-03-01T00:00:00Z');
		const to = Date.parse('2027-04-30T00:00:00Z');
		expect(transitions('America/Denver', from, to)).toEqual([
			{ at: Date.parse('2027-03-14T09:00:00Z'), from: -7 * 3_600_000, to: -6 * 3_600_000 }
		]);
		expect(transitions('America/Phoenix', from, to)).toEqual([]);
	});

	it('puts a late match on the next local day', () => {
		const lines = unfold(render([match('late@x', '2026-11-22T07:30:00Z', 'America/Los_Angeles')]));
		expect(lines).toContain('DTSTART;TZID=America/Los_Angeles:20261121T233000');
		expect(lines).toContain('DTEND;TZID=America/Los_Angeles:20261121T234000');
	});

	it('falls back to UTC for unknown zones', () => {
		const lines = unfold(
			render([
				match('utc@x', '2026-11-21T18:00:00Z', 'UTC'),
				match('bad@x', '2026-11-21T19:00:00Z', 'Mars/Olympus')
			])
		);
		expect(lines).toContain('DTSTART:20261121T180000Z');
		expect(lines).toContain('DTSTART:20261121T190000Z');
		expect(lines.some((line) => line.startsWith('BEGIN:VTIMEZONE'))).toBe(false);
	});

	it('writes one zone per time zone in use', () => {
		const text = render([
			match('a@x', '2026-11-21T18:00:00Z', 'America/Denver'),
			match('b@x', '2026-11-22T18:00:00Z', 'Asia/Almaty'),
			match('c@x', '2026-11-23T18:00:00Z', 'America/Denver')
		]);
		const zones = unfold(text).filter((line) => line.startsWith('TZID:'));
		expect(zones).toEqual(['TZID:America/Denver', 'TZID:Asia/Almaty']);
	});
});
