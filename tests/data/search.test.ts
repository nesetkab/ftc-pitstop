import { afterEach, describe, expect, it, vi } from 'vitest';
import { search } from '#lib/server/search.ts';
import type { EventSummary, SearchTeam } from '#lib/types.ts';

function team(number: number, name: string, city = 'Gilbert', state = 'AZ'): SearchTeam {
	return { number, name, city, state, country: 'USA' };
}

function event(code: string, name: string, start = '2026-11-14', city = 'Gilbert'): EventSummary {
	return { code, name, start, city, state: 'AZ', country: 'USA' } as EventSummary;
}

const teams = [
	team(26670, 'SCA Iron Eagles'),
	team(2670, 'Valley X Robotics', 'Phoenix'),
	team(267, 'Académie Éclair', 'Montréal', 'QC'),
	team(12670, 'Robo Rangers')
];

const events = [
	event('USAZGIQ', 'Roadrunner Gilbert Qualifier'),
	event('USAZPHQ', 'Phoenix Qualifier', '2026-12-01', 'Phoenix'),
	event('USCAQ', 'California Qualifier', '2026-10-01', 'San Jose')
];

const index = { teams, events };

afterEach(() => vi.restoreAllMocks());

describe('search', () => {
	it('finds teams by number, exact match first', () => {
		expect(search(index, '2670').teams.map((entry) => entry.number)).toEqual([2670]);
		expect(search(index, '267').teams.map((entry) => entry.number)).toEqual([267, 2670]);
		expect(search(index, '266').teams.map((entry) => entry.number)).toEqual([26670]);
	});

	it('finds teams by name or place and folds accents', () => {
		expect(search(index, 'eagles').teams.map((entry) => entry.number)).toEqual([26670]);
		expect(search(index, 'academie eclair').teams.map((entry) => entry.number)).toEqual([267]);
		expect(search(index, 'phoenix').teams.map((entry) => entry.number)).toEqual([2670]);
	});

	it('finds events by code, name or place and sorts equals by newest', () => {
		expect(search(index, 'usazgiq').events.map((entry) => entry.code)).toEqual(['USAZGIQ']);
		expect(search(index, 'qualifier').events.map((entry) => entry.code)).toEqual([
			'USAZPHQ',
			'USAZGIQ',
			'USCAQ'
		]);
		expect(search(index, 'san jose').events.map((entry) => entry.code)).toEqual(['USCAQ']);
	});

	it('answers nothing for an empty or symbol only query', () => {
		expect(search(index, '   ')).toEqual({ teams: [], events: [] });
		expect(search(index, '%%%')).toEqual({ teams: [], events: [] });
	});

	it('respects the limit', () => {
		expect(search(index, '2', 2).teams).toHaveLength(2);
	});

	it('prepares the lists once, not once per query', () => {
		const big = {
			teams: Array.from({ length: 2000 }, (_, i) => team(i + 1, `Team ${i} Robotics`)),
			events: Array.from({ length: 200 }, (_, i) => event(`E${i}`, `Event ${i}`))
		};
		search(big, 'robotics');
		const normalize = vi.spyOn(String.prototype, 'normalize');
		search(big, 'team 5');
		search(big, 'event 9');
		expect(normalize.mock.calls.length).toBeLessThanOrEqual(2);
	});
});
