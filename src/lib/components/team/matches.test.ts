import { describe, expect, it } from 'vitest';
import { fixtureBundle } from '#lib/components/event/test-fixtures.ts';
import { match, teamEvent, teamSeason } from './fixtures.ts';
import { teamMatches } from './matches.ts';

describe('teamMatches', () => {
	const bundle = fixtureBundle('USAZGIQ');
	const season = teamSeason(26670, 'SCA Iron Eagles', [
		teamEvent(),
		teamEvent({ code: 'LATER', name: 'Later Qualifier', start: '2026-12-12', end: '2026-12-12' })
	]);

	it('lists every match the team played with partners, opponents and parts', () => {
		const [event] = teamMatches(season, { USAZGIQ: bundle }, 26670);
		expect(event.code).toBe('USAZGIQ');
		expect(event.rows.map((row) => row.label)).toEqual([
			'Q1',
			'Q12',
			'Q15',
			'Q22',
			'Q32',
			'M3',
			'M7',
			'M9',
			'M10'
		]);
		expect(event.rows[0]).toMatchObject({
			alliance: 'red',
			partners: [32043],
			opponents: [26128, 38444],
			score: 89,
			against: 83,
			outcome: 'win',
			parts: { auto: 28, hive: 54, flower: 0, garden: 2, park: 5 }
		});
		expect(event.record).toEqual({ wins: 7, losses: 2, ties: 0 });
	});

	it('puts the newest event first and skips events without a bundle', () => {
		const later = {
			matches: [match(1, [26670, 1], [2, 3], '2026-12-12T16:00:00Z', false)]
		};
		const events = teamMatches(season, { USAZGIQ: bundle, LATER: later }, 26670);
		expect(events.map((event) => event.code)).toEqual(['LATER', 'USAZGIQ']);
		expect(events[0].rows[0]).toMatchObject({ outcome: null, score: null, parts: null });
		expect(teamMatches(season, { USAZGIQ: null }, 26670)).toEqual([]);
	});

	it('leaves surrogate matches out of the record', () => {
		const played = match(1, [26670, 1], [2, 3], '2026-12-12T16:00:00Z', true);
		played.red[0].surrogate = true;
		const solo = teamSeason(26670, 'SCA Iron Eagles', [teamEvent()]);
		const [event] = teamMatches(solo, { USAZGIQ: { matches: [played] } }, 26670);
		expect(event.rows[0].surrogate).toBe(true);
		expect(event.record).toEqual({ wins: 0, losses: 0, ties: 0 });
	});
});
