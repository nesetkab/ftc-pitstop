import { describe, expect, it } from 'vitest';
import { MISSING } from '#lib/format/index.ts';
import { followedBundle, match, ranking, teamEvent, teamSeason } from './fixtures.ts';
import { chooseEvent, followedRow, nextMatch, standing, unavailableRow } from './follow-status.ts';

const NOW = Date.parse('2026-11-14T20:41:00Z');
const NBSP = '\u00a0';

const earlier = teamEvent({
	code: 'OLD',
	name: 'Earlier Qualifier',
	start: '2026-11-07',
	end: '2026-11-07'
});
const today = teamEvent({ code: 'USAZGIQ' });
const later = teamEvent({
	code: 'LATER',
	name: 'Later Qualifier',
	start: '2026-12-05',
	end: '2026-12-06'
});

describe('chooseEvent', () => {
	it('prefers the event that is running today', () => {
		const season = teamSeason(26670, 'SCA Iron Eagles', [earlier, today, later]);
		expect(chooseEvent(season, NOW)).toMatchObject({
			standing: 'now',
			entry: { event: { code: 'USAZGIQ' } }
		});
	});

	it('falls back to the next event and then to the last one', () => {
		const upcoming = teamSeason(26670, 'SCA Iron Eagles', [earlier, later]);
		expect(chooseEvent(upcoming, NOW)).toMatchObject({
			standing: 'next',
			entry: { event: { code: 'LATER' } }
		});
		const done = teamSeason(26670, 'SCA Iron Eagles', [earlier]);
		expect(chooseEvent(done, NOW)).toMatchObject({
			standing: 'last',
			entry: { event: { code: 'OLD' } }
		});
	});

	it('has nothing for a team without events', () => {
		expect(chooseEvent(teamSeason(1, 'Nobody'), NOW)).toBeNull();
	});
});

describe('nextMatch and standing', () => {
	const bundle = followedBundle(
		[
			match(22, [26670, 18421], [14624, 2844], '2026-11-14T20:20:00Z', true),
			match(26, [14624, 25620], [32043, 26670], '2026-11-14T20:58:00Z', false),
			match(31, [26670, 1], [2, 3], '2026-11-14T21:31:00Z', false)
		],
		[ranking(1, 26670, 3, 0), ranking(2, 14624, 2, 1)]
	);

	it('names the next unplayed match with its time and alliance', () => {
		expect(nextMatch(bundle, 26670)).toBe(`Q26 at 1:58${NBSP}PM, blue`);
		expect(nextMatch(bundle, 14624)).toBe(`Q26 at 1:58${NBSP}PM, red`);
	});

	it('says when a team has no matches left or is not scheduled', () => {
		expect(nextMatch(bundle, 18421)).toBe('No matches left');
		expect(nextMatch(bundle, 99999)).toBe('Not scheduled');
		expect(nextMatch(followedBundle([], []), 26670)).toBe('Schedule not posted');
	});

	it('writes rank and record', () => {
		expect(standing(bundle, 14624)).toBe('2 of 2, 2-1-0');
		expect(standing(bundle, 99999)).toBe(MISSING);
	});
});

describe('followedRow', () => {
	const season = teamSeason(26670, 'SCA Iron Eagles', [today]);

	it('combines the current event with the next match and rank', () => {
		const table = Array.from({ length: 27 }, (_, index) =>
			ranking(index + 1, index === 6 ? 26670 : 1000 + index, 3, 0)
		);
		const bundle = followedBundle(
			[match(26, [26670, 1], [2, 3], '2026-11-14T20:58:00Z', false)],
			table
		);
		expect(followedRow(season, chooseEvent(season, NOW), bundle)).toEqual({
			team: 26670,
			name: 'SCA Iron Eagles',
			eventCode: 'USAZGIQ',
			event: 'Roadrunner - Gilbert Qualifier',
			when: 'Today',
			next: `Q26 at 1:58${NBSP}PM, red`,
			rank: '7 of 27, 3-0-0'
		});
	});

	it('describes upcoming and finished events without a bundle', () => {
		const upcoming = teamSeason(26670, 'SCA Iron Eagles', [later]);
		expect(followedRow(upcoming, chooseEvent(upcoming, NOW), null)).toMatchObject({
			when: 'Starts Dec 5',
			next: MISSING,
			rank: MISSING
		});
		const done = teamSeason(26670, 'SCA Iron Eagles', [earlier]);
		expect(followedRow(done, chooseEvent(done, NOW), null).when).toBe('Ended Nov 7');
	});

	it('handles teams without events and teams that failed to load', () => {
		expect(followedRow(teamSeason(1, 'Nobody'), null, null)).toMatchObject({
			eventCode: null,
			event: 'No events this season'
		});
		expect(unavailableRow(3747)).toMatchObject({
			team: 3747,
			name: null,
			event: 'Could not load this team'
		});
	});
});
