import { describe, expect, it } from 'vitest';
import { countTeams, teamCount } from './team-counts.server.ts';

const team = (teamNumber: number, played: boolean) => ({
	teamNumber,
	stats: played ? {} : null
});

const counts = countTeams({
	eventsSearch: [
		{
			code: 'usmtbuq',
			teams: [team(16, true), team(54, false), team(724, true), team(12793, false)]
		},
		{ code: 'USMTCMP', teams: [team(16, false), team(724, false)] },
		{ code: 'USEMPTY', teams: [] }
	]
});

const montana = { end: '2026-11-21', timezone: 'America/Denver' };
const after = Date.parse('2026-11-22T19:00:00Z');
const during = Date.parse('2026-11-21T19:00:00Z');

describe('event team counts', () => {
	it('counts registered and played teams per event', () => {
		expect(counts.USMTBUQ).toEqual({ registered: 4, played: 2 });
		expect(counts.USMTCMP).toEqual({ registered: 2, played: 0 });
	});

	it('counts only teams that played once the event is over', () => {
		expect(teamCount(montana, counts.USMTBUQ, after)).toBe(2);
	});

	it('counts every registered team before and during the event', () => {
		expect(teamCount(montana, counts.USMTBUQ, during)).toBe(4);
		expect(teamCount({ ...montana, end: '2026-12-12' }, counts.USMTCMP, after)).toBe(2);
	});

	it('falls back to registered teams when nobody has results', () => {
		expect(teamCount(montana, counts.USMTCMP, after)).toBe(2);
	});

	it('has no count for unknown or empty events', () => {
		expect(teamCount(montana, undefined, after)).toBeNull();
		expect(teamCount(montana, counts.USEMPTY, after)).toBeNull();
	});
});
