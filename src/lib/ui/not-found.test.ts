import { describe, expect, it } from 'vitest';
import { missingEvent, missingTeam, missingTeams } from './not-found.ts';

describe('not found copy', () => {
	it('names the event code that does not exist', () => {
		expect(missingEvent('/(app)/events/[code]', { code: 'zzzzzz' })).toEqual({
			title: 'Event not found',
			meta: 'No event has the code ZZZZZZ.',
			back: null
		});
	});

	it('does not repeat a malformed code back', () => {
		expect(missingEvent('/(app)/events/[code]', { code: '!!' }).meta).toBe(
			'There is no event at this address.'
		);
	});

	it('offers the event page when a match is missing', () => {
		expect(
			missingEvent('/(app)/events/[code]/matches/[key]', { code: 'USMTBUQ', key: 'q999' })
		).toEqual({
			title: 'Match not found',
			meta: 'This event has no match Q999.',
			back: { href: '/events/USMTBUQ', label: 'Back to the event' }
		});
	});

	it('offers the team list when a team is not at the event', () => {
		expect(
			missingEvent('/(app)/events/[code]/teams/[number]', { code: 'USMTBUQ', number: '99999' })
		).toEqual({
			title: 'Team not found at this event',
			meta: "Team 99999 isn't on the list for this event.",
			back: { href: '/events/USMTBUQ/teams', label: 'Teams at this event' }
		});
	});

	it('names a missing team number but not a malformed one', () => {
		expect(missingTeam('999998')).toBe('No team has the number 999998.');
		expect(missingTeam(19666)).toBe('No team has the number 19666.');
		expect(missingTeam('abc')).toBe('There is no team at this address.');
		expect(missingTeam(undefined)).toBe('There is no team at this address.');
	});

	it('lists several missing teams in one sentence', () => {
		expect(missingTeams([404])).toBe('No team has the number 404.');
		expect(missingTeams([404, 505, 606])).toBe('No teams have the numbers 404, 505 and 606.');
	});
});
