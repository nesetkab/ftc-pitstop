import { afterEach, describe, expect, it, vi } from 'vitest';
import { editDistance, search, standingsOf, timeBoost } from '#lib/server/search.ts';
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

const NOW = Date.parse('2026-11-20T18:00:00Z');

const world = {
	teams: [
		team(3747, 'The Hive', 'Sandy', 'UT'),
		team(373, 'Sidney High School', 'Sidney', 'MT'),
		team(3708, 'Iron Eagles Optimus', 'Austin', 'TX'),
		team(37470, 'CDMS RoboKnights', 'Brawley', 'CA'),
		team(10662, 'Lazer Sharks in Space', 'Eureka', 'MT'),
		team(18571, 'Robo Wolves', 'Manitowoc', 'WI'),
		team(36853, 'Robowolves', 'Odessa', 'FL'),
		team(8008, 'Robo-Wolves', 'Evansdale', 'IA'),
		team(10255, 'RoboDux', 'Zeeland', 'MI'),
		team(15605, 'Michigan Maniacs', 'Lincoln', 'MI'),
		team(12783, 'Norwalk RoboWarriors', 'Norwalk', 'IA'),
		team(37917, 'Copper Bots', 'Butte', 'MT'),
		team(24451, 'Robotic Butterflies', 'San Antonio', 'TX'),
		team(20270, 'Technomatrix', 'Montréal', 'QC')
	],
	events: [
		{ ...event('USMTBUQ', 'Montana Qualifier - Butte MT-Tech', '2026-11-20', 'Butte'), state: 'MT' },
		{
			...event('USCANOFRQ', 'NorCal Fremont #1 QT', '2026-11-15', 'Fremont'),
			state: 'CA',
			region: 'USCANO'
		},
		{
			...event('USCANOSJQ', 'San Jose Qualifier', '2026-11-21', 'San Jose'),
			state: 'CA',
			region: 'USCANO'
		},
		{ ...event('USMIWMM1', 'West Michigan Meet 1', '2026-11-21', 'Zeeland'), state: 'MI' },
		{ ...event('USMICMP', 'Michigan State Championship', '2027-03-20', 'Detroit'), state: 'MI' },
		{ ...event('USMIOLD', 'Michigan Kickoff', '2026-09-12', 'Detroit'), state: 'MI' }
	].map((entry) => ({ ...entry, end: entry.start }))
};

function teamNumbers(query: string, options = {}) {
	return search(world, query, 10, { now: NOW, ...options }).teams.map((entry) => entry.number);
}

function eventCodes(query: string) {
	return search(world, query, 10, { now: NOW }).events.map((entry) => entry.code);
}

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

	it('finds events by code, name or place and puts nearby dates first', () => {
		const now = Date.parse('2026-11-25T12:00:00Z');
		expect(search(index, 'usazgiq').events.map((entry) => entry.code)).toEqual(['USAZGIQ']);
		expect(search(index, 'qualifier', 10, { now }).events.map((entry) => entry.code)).toEqual([
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

describe('search ranking', () => {
	it('puts the exact number first, then shorter numbers, then longer ones', () => {
		expect(teamNumbers('3747')).toEqual([3747, 37470]);
		expect(teamNumbers('37')).toEqual([373, 3708, 3747, 37470, 37917]);
	});

	it('orders same length number matches by season rank', () => {
		const standings = standingsOf({
			teams: [
				{ team: 3747, opr: 80, rank: 3, matches: 10 },
				{ team: 3708, opr: 40, rank: 90, matches: 10 },
				{ team: 373, opr: 0, rank: 100, matches: 0 }
			]
		});
		expect(teamNumbers('37', { standings })).toEqual([373, 3747, 3708, 37470, 37917]);
		const [hive] = search(world, '3747', 1, { now: NOW, standings }).teams;
		expect(hive).toMatchObject({ number: 3747, opr: 80, rank: 3 });
	});

	it('forgives small typos and joined or split words', () => {
		expect(teamNumbers('lazer sharks')).toEqual([10662]);
		expect(teamNumbers('laser shark')).toEqual([10662]);
		expect(teamNumbers('robo wolves').slice(0, 3)).toEqual([8008, 18571, 36853]);
		expect(teamNumbers('robowolves').slice(0, 3)).toEqual([36853, 8008, 18571]);
		expect(teamNumbers('robo wolfes')).toContain(18571);
	});

	it('hides typo matches when something matches exactly', () => {
		expect(teamNumbers('norcal')).toEqual([]);
		expect(eventCodes('norcal')).toEqual(['USCANOFRQ', 'USCANOSJQ']);
	});

	it('folds accents both ways', () => {
		expect(teamNumbers('montreal')).toEqual([20270]);
		expect(teamNumbers('MONTRÉAL')).toEqual([20270]);
	});

	it('matches state names and region names', () => {
		expect(teamNumbers('michigan')).toEqual([15605, 10255]);
		expect(teamNumbers('robodux michigan')).toEqual([10255]);
		expect(eventCodes('norcal')).toContain('USCANOSJQ');
	});

	it('ranks names above places', () => {
		expect(teamNumbers('butte')).toEqual([24451, 37917]);
	});

	it('finds events by full or partial code', () => {
		expect(eventCodes('USMTBUQ')).toEqual(['USMTBUQ']);
		expect(eventCodes('usmt bu q')).toEqual(['USMTBUQ']);
		expect(eventCodes('usmi')).toEqual(['USMIWMM1', 'USMICMP', 'USMIOLD']);
		expect(eventCodes('usmiold')).toEqual(['USMIOLD']);
	});

	it('says which kind of result matched best', () => {
		expect(search(world, 'michigan', 10, { now: NOW }).lead).toBe('events');
		expect(search(world, '37', 10, { now: NOW }).lead).toBe('teams');
		expect(search(world, 'robodux', 10, { now: NOW }).lead).toBe('teams');
	});

	it('puts live and this week events above old ones', () => {
		expect(eventCodes('michigan')).toEqual(['USMIWMM1', 'USMICMP', 'USMIOLD']);
		expect(eventCodes('butte')).toEqual(['USMTBUQ']);
	});
});

describe('search helpers', () => {
	it('measures edit distance and gives up past the limit', () => {
		expect(editDistance('lazer', 'laser', 1)).toBe(1);
		expect(editDistance('wolves', 'wolfes', 2)).toBe(1);
		expect(editDistance('robot', 'rabbits', 1)).toBe(2);
		expect(editDistance('a', 'abcdef', 2)).toBe(3);
	});

	it('scores live events highest and old events lowest', () => {
		const day = (date: string) => Date.parse(`${date}T12:00:00Z`);
		const live = timeBoost(day('2026-11-20'), day('2026-11-21'), NOW);
		const soon = timeBoost(day('2026-11-24'), day('2026-11-24'), NOW);
		const lastWeek = timeBoost(day('2026-11-15'), day('2026-11-15'), NOW);
		const later = timeBoost(day('2027-02-01'), day('2027-02-01'), NOW);
		const old = timeBoost(day('2026-09-12'), day('2026-09-12'), NOW);
		expect(live).toBeGreaterThan(soon);
		expect(soon).toBeGreaterThan(lastWeek);
		expect(lastWeek).toBeGreaterThan(later);
		expect(later).toBeGreaterThan(old);
	});

	it('keeps only teams that played when building standings', () => {
		const standings = standingsOf({
			teams: [
				{ team: 1, opr: 10, rank: 1, matches: 4 },
				{ team: 2, opr: 0, rank: 2, matches: 0 }
			]
		});
		expect([...standings.keys()]).toEqual([1]);
		expect(standingsOf(null).size).toBe(0);
	});
});
