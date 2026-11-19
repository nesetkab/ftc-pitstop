import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, localDay, shortRange } from './dates.ts';

describe('localDay', () => {
	const instant = Date.parse('2026-11-15T02:30:00Z');

	it('uses the calendar day in the given time zone', () => {
		expect(localDay(instant, 'America/Phoenix')).toBe('2026-11-14');
		expect(localDay(instant, 'Asia/Shanghai')).toBe('2026-11-15');
		expect(localDay(instant, 'UTC')).toBe('2026-11-15');
	});

	it('falls back to UTC for a missing or invalid zone', () => {
		expect(localDay(instant, null)).toBe('2026-11-15');
		expect(localDay(instant, 'Not/AZone')).toBe('2026-11-15');
	});
});

describe('day arithmetic', () => {
	it('counts and adds whole days across months', () => {
		expect(daysBetween('2026-11-14', '2026-11-16')).toBe(2);
		expect(daysBetween('2026-11-16', '2026-11-14')).toBe(-2);
		expect(addDays('2026-11-29', 3)).toBe('2026-12-02');
		expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
	});
});

describe('shortRange', () => {
	it('writes one day, two days and longer ranges', () => {
		expect(shortRange('2026-11-14', '2026-11-14')).toBe('Nov 14');
		expect(shortRange('2026-11-20', '2026-11-21')).toBe('Nov 20 and 21');
		expect(shortRange('2026-11-20', '2026-11-22')).toBe('Nov 20 to 22');
		expect(shortRange('2026-11-30', '2026-12-01')).toBe('Nov 30 and Dec 1');
		expect(shortRange('2026-11-29', '2026-12-02')).toBe('Nov 29 to Dec 2');
	});
});
