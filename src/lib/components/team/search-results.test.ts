import { describe, expect, it } from 'vitest';
import { eventSummary } from './fixtures.ts';
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
		const results = toSearchResults({ teams: [team], events: [eventSummary()] });
		expect(results).toEqual([
			{
				type: 'team',
				label: '26670 SCA Iron Eagles',
				sublabel: 'Phoenix, Arizona',
				href: '/teams/26670'
			},
			{
				type: 'event',
				label: 'Roadrunner - Gilbert Qualifier',
				sublabel: 'USAZGIQ. Gilbert, Arizona. Saturday, November 14, 2026.',
				href: '/events/USAZGIQ'
			}
		]);
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
