import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, localDate, weekStart } from './calendar.ts';

describe('localDate', () => {
	const instant = Date.parse('2026-11-15T02:30:00Z');

	it('uses the calendar day in the given time zone', () => {
		expect(localDate(instant, 'America/Phoenix')).toBe('2026-11-14');
		expect(localDate(instant, 'Asia/Shanghai')).toBe('2026-11-15');
		expect(localDate(instant, 'UTC')).toBe('2026-11-15');
	});

	it('falls back to UTC for a missing or invalid zone', () => {
		expect(localDate(instant, null)).toBe('2026-11-15');
		expect(localDate(instant, undefined)).toBe('2026-11-15');
		expect(localDate(instant, 'Not/AZone')).toBe('2026-11-15');
	});
});

describe('day arithmetic', () => {
	it('counts and adds whole days across months and years', () => {
		expect(daysBetween('2026-11-14', '2026-11-16')).toBe(2);
		expect(daysBetween('2026-11-16', '2026-11-14')).toBe(-2);
		expect(addDays('2026-11-29', 3)).toBe('2026-12-02');
		expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('finds the Monday that starts the week', () => {
		expect(weekStart('2026-11-14')).toBe('2026-11-09');
		expect(weekStart('2026-11-09')).toBe('2026-11-09');
		expect(weekStart('2026-11-15')).toBe('2026-11-09');
	});
});
