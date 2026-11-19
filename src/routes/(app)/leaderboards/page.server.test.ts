import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeasonRatings } from '#lib/analysis/types.ts';
import type { LeaderboardRow } from '#lib/components/team/leaderboard.ts';
import { load } from './+page.server.ts';

const server = vi.hoisted(() => ({
	loadSeasonRatingsWithin: vi.fn(),
	searchIndex: vi.fn(),
	scoutLoad: vi.fn()
}));

vi.mock('#lib/server/analysis.ts', () => ({
	loadSeasonRatingsWithin: server.loadSeasonRatingsWithin
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
	filters: { region: string; country: string; state: string; min: number; page: number };
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
	events: [],
	fetchedAt: 5
};

beforeEach(() => {
	for (const mock of Object.values(server)) mock.mockReset();
	server.loadSeasonRatingsWithin.mockResolvedValue(null);
	server.searchIndex.mockResolvedValue(directory);
	server.scoutLoad.mockRejectedValue(new Error('down'));
});

describe('leaderboards load with season ratings', () => {
	it('ranks teams by OPR, adds names and leaves out teams with no matches', async () => {
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
		expect(server.searchIndex).not.toHaveBeenCalled();
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
