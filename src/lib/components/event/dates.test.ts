import { describe, expect, it } from 'vitest';
import { eventDay, eventStatus, statusLabel } from './dates.ts';

const twoDay = { start: '2026-11-21', end: '2026-11-22', timezone: 'America/Chicago' };
const oneDay = { start: '2026-11-21', end: '2026-11-21', timezone: 'America/Chicago' };

function label(event: typeof twoDay, now: number) {
	return statusLabel(event, eventStatus(event, now), now);
}

describe('event status labels', () => {
	it('names the day of a running event instead of calling it live', () => {
		expect(eventDay(oneDay, Date.parse('2026-11-21T15:00:00Z'))).toBe('Today');
		expect(eventDay(twoDay, Date.parse('2026-11-21T15:00:00Z'))).toBe('Day 1 of 2');
		expect(eventDay(twoDay, Date.parse('2026-11-22T15:00:00Z'))).toBe('Day 2 of 2');
	});

	it('uses the event time zone to pick the day', () => {
		expect(label(twoDay, Date.parse('2026-11-22T03:00:00Z'))).toBe('Day 1 of 2');
		expect(label(twoDay, Date.parse('2026-11-23T03:00:00Z'))).toBe('Day 2 of 2');
	});

	it('labels events before and after their dates', () => {
		expect(label(oneDay, Date.parse('2026-11-20T15:00:00Z'))).toBe('Upcoming');
		expect(label(oneDay, Date.parse('2026-11-22T15:00:00Z'))).toBe('Done');
		expect(label(oneDay, Date.parse('2026-11-21T15:00:00Z'))).toBe('Today');
	});
});
