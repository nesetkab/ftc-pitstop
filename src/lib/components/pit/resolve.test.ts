import { describe, expect, it } from 'vitest';
import type { EventSummary, EventType } from '#lib/types.ts';
import { localDay, pickEvent } from './resolve.ts';

function event(
	code: string,
	start: string,
	end = start,
	type: EventType = 'Qualifier'
): EventSummary {
	return {
		code,
		name: code,
		type,
		typeName: type,
		region: null,
		league: null,
		venue: null,
		city: null,
		state: null,
		country: null,
		timezone: 'America/Phoenix',
		start,
		end,
		hasMatches: null
	};
}

const at = (iso: string) => Date.parse(iso);

describe('pickEvent', () => {
	const season = [
		event('KICKOFF', '2026-09-12', '2026-09-12', 'Kickoff'),
		event('FIRST', '2026-10-17'),
		event('SECOND', '2026-11-14'),
		event('THIRD', '2026-12-05', '2026-12-06')
	];

	it('picks the event that is on today in its own time zone', () => {
		expect(pickEvent(season, at('2026-11-14T15:00:00Z'))).toMatchObject({
			event: { code: 'SECOND' },
			reason: 'today'
		});
		expect(pickEvent(season, at('2026-11-15T05:30:00Z'))).toMatchObject({
			event: { code: 'SECOND' },
			reason: 'today'
		});
		expect(pickEvent(season, at('2026-12-06T20:00:00Z'))?.event.code).toBe('THIRD');
	});

	it('falls back to the next event, then the most recent one', () => {
		expect(pickEvent(season, at('2026-11-15T08:00:00Z'))).toMatchObject({
			event: { code: 'THIRD' },
			reason: 'next'
		});
		expect(pickEvent(season, at('2026-09-01T12:00:00Z'))?.event.code).toBe('FIRST');
		expect(pickEvent(season, at('2027-01-10T12:00:00Z'))).toMatchObject({
			event: { code: 'THIRD' },
			reason: 'last'
		});
	});

	it('ignores events without matches and handles an empty season', () => {
		expect(pickEvent([season[0]], at('2026-09-12T18:00:00Z'))).toBeNull();
		expect(pickEvent([], Date.now())).toBeNull();
	});

	it('formats the local day', () => {
		expect(localDay(at('2026-11-15T05:30:00Z'), 'America/Phoenix')).toBe('2026-11-14');
		expect(localDay(at('2026-11-15T05:30:00Z'), 'Not/AZone')).toBe('2026-11-15');
	});
});
