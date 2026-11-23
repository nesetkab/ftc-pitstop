import { describe, expect, it } from 'vitest';
import {
	addDays,
	isValidTimeZone,
	localDate,
	startOfLocalDay,
	timeZoneOffset,
	zonedTimeToUtc
} from '#lib/format/calendar.ts';

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

describe('zonedTimeToUtc', () => {
	it('converts FTC venue times with and without fractions', () => {
		expect(iso(zonedTimeToUtc('2026-11-14T10:30:00', 'America/Phoenix'))).toBe(
			'2026-11-14T17:30:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2026-11-14T10:33:17.955', 'America/Phoenix'))).toBe(
			'2026-11-14T17:33:17.955Z'
		);
		expect(iso(zonedTimeToUtc('2026-11-14T16:01:06.45', 'America/Phoenix'))).toBe(
			'2026-11-14T23:01:06.450Z'
		);
		expect(iso(zonedTimeToUtc('2026-11-14T16:40:00', 'Asia/Tashkent'))).toBe(
			'2026-11-14T11:40:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2026-11-14T09:00:00', 'Australia/Sydney'))).toBe(
			'2026-11-13T22:00:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2026-11-14', 'America/New_York'))).toBe('2026-11-14T05:00:00.000Z');
	});

	it('handles half hour and odd offsets', () => {
		expect(iso(zonedTimeToUtc('2026-11-14T12:00:00', 'Asia/Kolkata'))).toBe(
			'2026-11-14T06:30:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2026-11-14T12:00:00', 'America/St_Johns'))).toBe(
			'2026-11-14T15:30:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2026-11-14T12:00:00', 'Asia/Kathmandu'))).toBe(
			'2026-11-14T06:15:00.000Z'
		);
	});

	it('moves times in the spring forward gap ahead by the gap', () => {
		expect(iso(zonedTimeToUtc('2027-03-14T02:30:00', 'America/New_York'))).toBe(
			'2027-03-14T07:30:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2027-03-14T01:59:59', 'America/New_York'))).toBe(
			'2027-03-14T06:59:59.000Z'
		);
		expect(iso(zonedTimeToUtc('2027-03-14T03:00:00', 'America/New_York'))).toBe(
			'2027-03-14T07:00:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2027-03-28T01:30:00', 'Europe/London'))).toBe(
			'2027-03-28T01:30:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2027-03-28T02:15:00', 'Europe/London'))).toBe(
			'2027-03-28T01:15:00.000Z'
		);
	});

	it('picks the first occurrence of times repeated when clocks fall back', () => {
		expect(iso(zonedTimeToUtc('2026-11-01T01:30:00', 'America/New_York'))).toBe(
			'2026-11-01T05:30:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2026-11-01T00:59:00', 'America/Chicago'))).toBe(
			'2026-11-01T05:59:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2026-11-01T02:00:00', 'America/New_York'))).toBe(
			'2026-11-01T07:00:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2026-10-25T02:30:00', 'Europe/Berlin'))).toBe(
			'2026-10-25T00:30:00.000Z'
		);
	});

	it('handles southern hemisphere transitions', () => {
		expect(iso(zonedTimeToUtc('2026-10-04T02:30:00', 'Australia/Sydney'))).toBe(
			'2026-10-03T16:30:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2027-04-04T02:30:00', 'Australia/Sydney'))).toBe(
			'2027-04-03T15:30:00.000Z'
		);
	});

	it('keeps explicit offsets and falls back to UTC for bad zones', () => {
		expect(iso(zonedTimeToUtc('2026-11-14T10:30:00Z', 'America/Phoenix'))).toBe(
			'2026-11-14T10:30:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2026-11-14T10:30:00-05:00', 'America/Phoenix'))).toBe(
			'2026-11-14T15:30:00.000Z'
		);
		expect(iso(zonedTimeToUtc('2026-11-14T10:30:00', 'Mars/Olympus'))).toBe(
			'2026-11-14T10:30:00.000Z'
		);
		expect(zonedTimeToUtc('not a time', 'UTC')).toBeNull();
	});

	it('round trips times across a season in busy FTC zones', () => {
		const zones = [
			'America/New_York',
			'America/Chicago',
			'America/Denver',
			'America/Los_Angeles',
			'Europe/Bucharest'
		];
		for (const zone of zones) {
			const format = new Intl.DateTimeFormat('en-CA', {
				timeZone: zone,
				hourCycle: 'h23',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			});
			for (let t = Date.UTC(2026, 8, 1); t < Date.UTC(2027, 8, 1); t += 53 * 60_000) {
				const parts = format.formatToParts(new Date(t));
				const get = (type: string) => parts.find((part) => part.type === type)!.value;
				const local = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
				const back = zonedTimeToUtc(local, zone)!;
				expect(back === t || back === t - 3_600_000).toBe(true);
			}
		}
	}, 30_000);
});

describe('time helpers', () => {
	it('computes offsets', () => {
		expect(timeZoneOffset(Date.UTC(2026, 6, 1), 'America/New_York')).toBe(-4 * 3_600_000);
		expect(timeZoneOffset(Date.UTC(2026, 11, 1), 'America/New_York')).toBe(-5 * 3_600_000);
		expect(timeZoneOffset(Date.UTC(2026, 11, 1, 0, 0, 0, 999), 'Asia/Kolkata')).toBe(
			5.5 * 3_600_000
		);
	});

	it('finds local dates', () => {
		const instant = Date.parse('2026-11-15T03:30:00Z');
		expect(localDate(instant, 'America/Phoenix')).toBe('2026-11-14');
		expect(localDate(instant, 'Asia/Shanghai')).toBe('2026-11-15');
		expect(localDate(instant, 'Nope/Nope')).toBe('2026-11-15');
	});

	it('finds the start of a local day and adds days', () => {
		expect(iso(startOfLocalDay('2026-11-14', 'America/Phoenix'))).toBe('2026-11-14T07:00:00.000Z');
		expect(iso(startOfLocalDay('2027-03-14T00:00:00', 'America/New_York'))).toBe(
			'2027-03-14T05:00:00.000Z'
		);
		expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
	});

	it('validates zones', () => {
		expect(isValidTimeZone('America/Phoenix')).toBe(true);
		expect(isValidTimeZone('Not/AZone')).toBe(false);
		expect(isValidTimeZone('')).toBe(false);
		expect(isValidTimeZone(null)).toBe(false);
	});
});
