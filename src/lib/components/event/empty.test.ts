import { describe, expect, it } from 'vitest';
import type { EventBundle } from '#lib/types.ts';
import { previewText, resultsText, scheduleText, teamsAction } from './empty.ts';
import { fixtureBundle } from './test-fixtures.ts';

const full = fixtureBundle('USMTBUQ-final');

function bundle(change: Partial<EventBundle>): EventBundle {
	return { ...full, ...change };
}

describe('event empty states', () => {
	it('says the team list and schedule are both missing in one sentence', () => {
		expect(previewText(bundle({ phase: 'upcoming', matches: [], teams: [] }))).toBe(
			"The team list and match schedule haven't been posted yet."
		);
	});

	it('waits for the schedule when teams are known', () => {
		expect(previewText(bundle({ phase: 'upcoming', matches: [] }))).toBe(
			"The match schedule hasn't been posted yet."
		);
	});

	it('waits for the first match when the schedule is out', () => {
		expect(previewText(bundle({ phase: 'upcoming' }))).toBe(
			"Qualification matches haven't started yet."
		);
	});

	it('talks about a finished event in the past tense', () => {
		expect(previewText(bundle({ phase: 'done', matches: [], teams: [] }))).toBe(
			'No teams or matches were posted for this event.'
		);
		expect(previewText(bundle({ phase: 'done', matches: [] }))).toBe(
			'No match schedule was posted for this event.'
		);
		expect(previewText(bundle({ phase: 'done' }))).toBe('No results were posted for this event.');
		expect(scheduleText({ phase: 'done' })).toBe('No match schedule was posted for this event.');
		expect(resultsText({ phase: 'done' })).toBe('No results were posted for this event.');
	});

	it('keeps the upcoming wording before the event ends', () => {
		expect(scheduleText({ phase: 'upcoming' })).toBe("The match schedule hasn't been posted yet.");
		expect(resultsText({ phase: 'quals' })).toBe('No matches have been played yet.');
	});

	it('links back to the team list only when the event tabs are hidden', () => {
		expect(teamsAction(bundle({ matches: [], rankings: [] }))).toEqual({
			href: `/events/${full.event.code}`,
			label: 'See the teams'
		});
		expect(teamsAction(full)).toBeNull();
		expect(teamsAction(bundle({ matches: [], rankings: [], teams: [] }))).toBeNull();
	});
});
