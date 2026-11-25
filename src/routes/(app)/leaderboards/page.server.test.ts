import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeasonEventRatings, SeasonRatings } from '#lib/analysis/types.ts';
import type { LeaderboardRow } from '#lib/components/leaderboard/leaderboard.ts';
import { load } from './+page.server.ts';

const server = vi.hoisted(() => ({
	loadSeasonRatingsWithin: vi.fn(),
	loadSeasonEventRatingsWithin: vi.fn(),
	searchIndex: vi.fn(),
	scoutLoad: vi.fn()
}));

vi.mock('#lib/server/analysis.ts', () => ({
	loadSeasonRatingsWithin: server.loadSeasonRatingsWithin,
	loadSeasonEventRatingsWithin: server.loadSeasonEventRatingsWithin
}));
vi.mock('#lib/server/event.ts', () => ({ searchIndex: server.searchIndex }));
vi.mock('./scout.server.ts', () => ({ scoutLeaderboard: { load: server.scoutLoad } }));

type Result = Awaited<ReturnType<typeof load>> & {
	source: string;
	rows: LeaderboardRow[];
	total: number;
	page: number;
	pages: number;
	start: number;
	population: number;
	states: { value: string; label: string }[];
	regions: { value: string }[];
	filters: {
		region: string;
		country: string;
		state: string;
		min: number;
		page: number;
		type: string;
		dates: string;
		from: string;
		to: string;
	};
	window: { from: string; to: string } | null;
	types: { value: string; label: string }[];
	weeks: { value: string; label: string }[];
	found: boolean;
};

function call(query = '') {
	const setHeaders = vi.fn();
	const result = load({
		url: new URL(`https://ftcpitstop.com/leaderboards${query}`),
		setHeaders
	} as never) as Promise<Result>;
	return { result, setHeaders };
}

function ratings(count: number, generatedAt = 1): SeasonRatings {
	return {
		generatedAt,
		teams: Array.from({ length: count }, (_, index) => ({
			team: 1000 + index,
			opr: 200 - index,
			parts: { auto: 20, hive: 100, flower: 5, garden: 5, park: 10, tips: 3 },
			matches: index % 7 === 0 ? 0 : 6 + (index % 10),
			events: 1 + (index % 3),
			rank: index + 1,
			percentile: 0.5,
			region: index % 2 === 0 ? 'USAZ' : 'USCALA'
		}))
	};
}

const directory = {
	teams: [
		{ number: 1001, name: 'Valley X', city: 'Chandler', state: 'AZ', country: 'USA' },
		{ number: 1002, name: 'Los Robots', city: 'Los Angeles', state: 'CA', country: 'USA' }
	],
	events: [
		{ type: 'Qualifier', start: '2026-11-14', hasMatches: true },
		{ type: 'LeagueMeet', start: '2026-11-07', hasMatches: true }
	],
	fetchedAt: 5
};

beforeEach(() => {
	for (const mock of Object.values(server)) mock.mockReset();
	server.loadSeasonRatingsWithin.mockResolvedValue(null);
	server.searchIndex.mockResolvedValue(directory);
	server.loadSeasonEventRatingsWithin.mockResolvedValue(null);
	server.scoutLoad.mockRejectedValue(new Error('down'));
});

describe('leaderboards load with season ratings', () => {
	it('ranks teams by aOPR, adds names and leaves out teams with no matches', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings(120, 10));
		const { result, setHeaders } = call();
		const data = await result;
		expect(data.source).toBe('ratings');
		expect(data.rows).toHaveLength(50);
		expect(data.rows[0]).toMatchObject({ team: 1001, name: 'Valley X', city: 'Chandler' });
		expect(data.rows.every((row) => row.matches > 0)).toBe(true);
		expect(data.rows.map((row) => row.opr)).toEqual(
			[...data.rows.map((row) => row.opr)].sort((a, b) => b - a)
		);
		expect(data.population).toBe(120 - Math.ceil(120 / 7));
		expect(data.total).toBe(data.population);
		expect(setHeaders).toHaveBeenCalledWith({
			'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600'
		});
	});

	it('pages the list and numbers the ranks from the start of the page', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings(200, 20));
		const data = await call('?page=2').result;
		expect(data).toMatchObject({ page: 2, start: 50 });
		expect(data.rows).toHaveLength(50);
		expect((await call('?page=999').result).page).toBe(data.pages);
	});

	it('filters by region and minimum matches', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings(120, 30));
		const data = await call('?region=USAZ&min=10').result;
		expect(data.filters).toMatchObject({ region: 'USAZ', min: 10 });
		expect(data.rows.length).toBeGreaterThan(0);
		expect(data.rows.every((row) => row.region === 'USAZ' && row.matches >= 10)).toBe(true);
	});

	it('sorts by another column and finds teams by name', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings(120, 31));
		const sorted = await call('?sort=matches').result;
		const matches = sorted.rows.map((row) => row.matches);
		expect(matches).toEqual([...matches].sort((a, b) => b - a));
		const found = await call('?q=valley').result;
		expect(found.rows.map((row) => row.team)).toEqual([1001]);
	});

	it('opens the page with the team asked for unless a page is given', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings(200, 32));
		const data = await call('?team=1150').result;
		expect(data.page).toBe(3);
		expect(data.found).toBe(true);
		expect(data.rows.some((row) => row.team === 1150)).toBe(true);
		expect((await call('?team=1150&page=1').result).page).toBe(1);
		const missing = await call('?team=1000').result;
		expect(missing).toMatchObject({ page: 1, found: false });
	});

	it('offers the states of the chosen country', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings(120, 40));
		expect((await call().result).states).toEqual([]);
		const data = await call('?country=USA&state=AZ').result;
		expect(data.states).toEqual([
			{ value: 'AZ', label: 'Arizona' },
			{ value: 'CA', label: 'California' }
		]);
		expect(data.rows.every((row) => row.state === 'AZ')).toBe(true);
	});

	it('still ranks teams when the team directory is unavailable', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings(60, 50));
		server.searchIndex.mockRejectedValue(new Error('down'));
		const data = await call().result;
		expect(data.rows[0]).toMatchObject({ team: 1001, name: null, city: null });
	});
});

function table(generatedAt = 7): SeasonEventRatings {
	const flat = (teams: number[], opr: (team: number) => number) =>
		teams.flatMap((team) => [team, opr(team), 10, 2, 5]);
	const all = Array.from({ length: 120 }, (_, index) => 1000 + index);
	return {
		generatedAt,
		events: [
			{
				code: 'MEET',
				type: 'LeagueMeet',
				start: '2026-11-07',
				teams: flat(
					all.filter((team) => team % 2 === 1),
					(team) => team - 900
				)
			},
			{
				code: 'QUAL',
				type: 'Qualifier',
				start: '2026-11-14',
				teams: flat(
					all.filter((team) => team % 3 === 0),
					(team) => 1200 - team
				)
			}
		]
	};
}

describe('leaderboards load with event filters', () => {
	it('does not read event ratings for the whole season', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings(120, 60));
		const data = await call().result;
		expect(server.loadSeasonEventRatingsWithin).not.toHaveBeenCalled();
		expect(data.window).toBeNull();
		expect(data.types.map((option) => option.value)).toEqual([
			'official',
			'LeagueMeet',
			'Qualifier'
		]);
		expect(data.weeks.map((option) => option.value)).toEqual(['2026-11-09', '2026-11-02']);
	});

	it('ranks only the teams at the chosen event type by their rating there', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings(120, 61));
		server.loadSeasonEventRatingsWithin.mockResolvedValue(table());
		const data = await call('?type=LeagueMeet').result;
		expect(data.filters.type).toBe('LeagueMeet');
		expect(data.total).toBe(51);
		expect(data.population).toBe(51);
		expect(data.rows[0]).toMatchObject({ team: 1117, opr: 217, matches: 5, events: 1 });
		expect(data.rows.every((row) => row.team % 2 === 1)).toBe(true);
	});

	it('keeps the date range, sort, search and team jump working together', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings(120, 62));
		server.loadSeasonEventRatingsWithin.mockResolvedValue(table());
		const week = await call('?from=2026-11-09&to=2026-11-15').result;
		expect(week.window).toEqual({ from: '2026-11-09', to: '2026-11-15' });
		expect(week.total).toBe(34);
		expect(week.rows[0]).toMatchObject({ team: 1002, opr: 198 });
		const jump = await call('?from=2026-11-09&to=2026-11-15&team=1110').result;
		expect(jump).toMatchObject({ found: true, page: 1 });
		const deep = await call('?type=Qualifier&team=1002').result;
		expect(deep.found).toBe(true);
		const found = await call('?type=Qualifier&q=valley').result;
		expect(found.rows).toEqual([]);
		const sorted = await call('?dates=recent&sort=matches&region=USAZ').result;
		expect(sorted.rows.every((row) => row.region === 'USAZ')).toBe(true);
	});

	it('answers 503 while event ratings are still loading', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings(120, 63));
		await expect(call('?type=Qualifier').result).rejects.toMatchObject({ status: 503 });
	});

	it('ignores event filters when only FTCScout data is there', async () => {
		server.scoutLoad.mockResolvedValue({ rows: [], fetchedAt: 9 });
		const data = await call('?type=Qualifier&dates=recent').result;
		expect(data.source).toBe('scout');
		expect(data.filters).toMatchObject({ type: '', dates: '', from: '', to: '' });
		expect(data.window).toBeNull();
	});
});

describe('leaderboards load without season ratings', () => {
	const rows: LeaderboardRow[] = [
		{
			team: 19666,
			name: 'Forever Knight',
			city: 'Shanghai',
			state: 'SH',
			country: 'China',
			region: 'CN',
			opr: 162.8,
			auto: 28.5,
			teleop: 134.2,
			tips: 7.2,
			matches: 6,
			events: null
		},
		{
			team: 16010,
			name: 'Astra Machina',
			city: 'Omaha',
			state: 'NE',
			country: 'USA',
			region: 'USNE',
			opr: 157.3,
			auto: 45.4,
			teleop: 111.9,
			tips: 7.2,
			matches: 5,
			events: null
		}
	];

	it('ranks by best event OPR from FTCScout', async () => {
		server.scoutLoad.mockResolvedValue({ rows, fetchedAt: 100 });
		const data = await call().result;
		expect(data.source).toBe('scout');
		expect(data.rows.map((row) => row.team)).toEqual([19666, 16010]);
		expect(data.population).toBe(2);
		expect(data.types).toEqual([]);
	});

	it('uses FTCScout when ratings exist but no team has played', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue({
			generatedAt: 1,
			teams: ratings(5).teams.map((team) => ({ ...team, matches: 0 }))
		});
		server.scoutLoad.mockResolvedValue({ rows, fetchedAt: 101 });
		expect((await call().result).source).toBe('scout');
	});

	it('answers 503 when neither source works', async () => {
		await expect(call().result).rejects.toMatchObject({ status: 503 });
	});
});
