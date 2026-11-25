import { describe, expect, it } from 'vitest';
import { eventSummary } from '#lib/components/team/fixtures.ts';
import { toSearchResults } from './search-results.ts';

const team = {
	number: 26670,
	name: 'SCA Iron Eagles',
	city: 'Phoenix',
	state: 'AZ',
	country: 'USA'
};

describe('toSearchResults', () => {
	it('turns the search API response into dialog results', () => {
		const now = Date.parse('2026-11-20T18:00:00Z');
		const results = toSearchResults({ teams: [team], events: [eventSummary()] }, now);
		expect(results).toEqual([
			{
				type: 'team',
				label: '26670 SCA Iron Eagles',
				sublabel: 'Phoenix, AZ',
				meta: null,
				aside: 'Phoenix, AZ',
				href: '/teams/26670'
			},
			{
				type: 'event',
				label: 'Roadrunner - Gilbert Qualifier',
				sublabel: 'USAZGIQ · Gilbert, AZ · Nov 14',
				meta: 'Done',
				aside: 'Nov 14',
				live: false,
				href: '/events/USAZGIQ'
			}
		]);
	});

	it('shows season aOPR and rank for a team that has played', () => {
		const [result] = toSearchResults({ teams: [{ ...team, opr: 85.24, rank: 12 }] });
		expect(result.meta).toBe('85.2 aOPR · #12');
	});

	it('marks events that are running now', () => {
		const event = eventSummary({ start: '2026-11-20', end: '2026-11-21' });
		const live = toSearchResults({ events: [event] }, Date.parse('2026-11-21T18:00:00Z'));
		expect(live[0]).toMatchObject({ meta: 'Day 2 of 2', aside: 'Day 2 of 2', live: true });
		expect(live[0].sublabel).toBe('USAZGIQ · Gilbert, AZ · Nov 20–21');
		const soon = toSearchResults({ events: [event] }, Date.parse('2026-11-10T18:00:00Z'));
		expect(soon[0]).toMatchObject({ meta: 'Upcoming', aside: 'Nov 20–21', live: false });
	});

	it('leaves the place out for a team that has none', () => {
		const [result] = toSearchResults({
			teams: [{ number: 1, name: 'Nowhere', city: null, state: null, country: null }]
		});
		expect(result.sublabel).toBeNull();
	});

	it('passes through results that are already in the dialog format', () => {
		const ready = { type: 'team', label: '1 One', href: '/teams/1' };
		expect(toSearchResults([ready])).toEqual([ready]);
		expect(toSearchResults({ results: [ready, { nope: true }] })).toEqual([ready]);
	});

	it('ignores anything it does not understand', () => {
		expect(toSearchResults(null)).toEqual([]);
		expect(toSearchResults('teams')).toEqual([]);
		expect(toSearchResults({ teams: [{ name: 'no number' }], events: [42] })).toEqual([]);
		expect(toSearchResults({ teams: [], events: [] })).toEqual([]);
	});
});
