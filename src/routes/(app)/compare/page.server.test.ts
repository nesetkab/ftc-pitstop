import { beforeEach, describe, expect, it, vi } from 'vitest';
import { teamEvent, teamSeason } from '#lib/components/team/fixtures.ts';
import { COMPONENTS } from '#lib/model/opr.ts';
import { SwarmBook } from '#lib/model/rp.ts';
import { load } from './+page.server.ts';

const server = vi.hoisted(() => ({
	loadTeamSeason: vi.fn(),
	loadSeasonRatingsWithin: vi.fn(),
	loadSeasonModelWithin: vi.fn(),
	recordNames: vi.fn()
}));

vi.mock('#lib/server/event.ts', () => ({ loadTeamSeason: server.loadTeamSeason }));
vi.mock('#lib/server/analysis.ts', () => ({
	loadSeasonRatingsWithin: server.loadSeasonRatingsWithin,
	loadSeasonModelWithin: server.loadSeasonModelWithin
}));
vi.mock('#lib/server/records.ts', () => ({ recordNames: server.recordNames }));

type Result = {
	numbers: number[];
	missing: number[];
	suggestions: { number: number; name: string | null }[];
	view: {
		teams: { number: number }[];
		shared: { code: string }[];
		meetings: { key: string }[];
		history: boolean;
		fit: { alliances: { teams: number[] }[] } | null;
	};
	trend: { number: number; points: unknown[] }[];
};

function call(query: string) {
	const setHeaders = vi.fn();
	const url = new URL(`https://ftcpitstop.com/compare${query}`);
	const result = load({ url, setHeaders } as never) as Promise<Result>;
	return { result, setHeaders };
}

const played = {
	rank: 1,
	rs: 0,
	tbp: 0,
	avgTips: 0,
	wins: 5,
	losses: 0,
	ties: 0,
	dq: 0,
	played: 5,
	opr: { total: 80, auto: 10, teleop: 70 }
};

beforeEach(() => {
	for (const mock of Object.values(server)) mock.mockReset();
	server.loadSeasonRatingsWithin.mockResolvedValue(null);
	server.recordNames.mockResolvedValue({ teams: {}, events: {} });
	server.loadSeasonModelWithin.mockResolvedValue(null);
	server.loadTeamSeason.mockImplementation(async (number: number) =>
		number === 404
			? null
			: teamSeason(number, `Team ${number}`, [{ ...teamEvent({ code: 'BBB' }), stats: played }])
	);
});

describe('compare load', () => {
	it('sends added teams to the canonical link', async () => {
		await expect(call('?teams=100&add=200 300').result).rejects.toMatchObject({
			status: 303,
			location: '/compare?teams=100,200,300'
		});
		await expect(call('?teams=100%2C100%2C200').result).rejects.toMatchObject({
			location: '/compare?teams=100,200'
		});
	});

	it('does not redirect a canonical link however its commas are encoded', async () => {
		await expect(call('?teams=100%2C200').result).resolves.toMatchObject({ numbers: [100, 200] });
		await expect(call('?teams=100,200').result).resolves.toMatchObject({ numbers: [100, 200] });
	});

	it('loads each team once and keeps the page short lived while history loads', async () => {
		const { result, setHeaders } = call('?teams=100,200,404');
		const data = await result;
		expect(data.numbers).toEqual([100, 200]);
		expect(data.missing).toEqual([404]);
		expect(server.loadTeamSeason).toHaveBeenCalledTimes(3);
		expect(data.view.shared.map((event) => event.code)).toEqual(['BBB']);
		expect(data.view.history).toBe(false);
		expect(data.view.fit).toBeNull();
		expect(data.suggestions).toEqual([]);
		expect(server.recordNames).not.toHaveBeenCalled();
		expect(setHeaders).toHaveBeenCalledWith({
			'cache-control': 'public, s-maxage=30, stale-while-revalidate=300'
		});
	});

	it('sends only the season matches the teams met in, and their alliance fit', async () => {
		const side = (teams: number[], total: number) => ({ teams, noShows: [], total });
		const seasonMatch = (key: string, red: number[], blue: number[]) => ({
			eventCode: 'BBB',
			date: '2026-11-14',
			time: null,
			key,
			level: 'qual',
			series: 0,
			number: Number(key.slice(1)),
			red: side(red, 100),
			blue: side(blue, 90)
		});
		const components = { auto: 10, teleop: 40, hive: 30, flower: 0, garden: 2, park: 5 };
		const rating = (opr: number) => ({ opr, components: { ...components, leave: 6, tips: 2 } });
		server.loadSeasonModelWithin.mockResolvedValue({
			generatedAt: 1,
			ratings: { generatedAt: 1, teams: [] },
			events: [],
			matches: [
				seasonMatch('q1', [100, 200], [1, 2]),
				seasonMatch('q2', [100, 3], [4, 5]),
				seasonMatch('q3', [3, 4], [200, 100])
			],
			run: {
				latest: new Map([
					[100, rating(50)],
					[200, rating(40)],
					[7, rating(20)]
				]),
				states: new Map(),
				stats: { mean: 100, sd: 30, parts: COMPONENTS.map(() => 5), matches: 100 },
				swarm: new SwarmBook()
			}
		});
		const { result, setHeaders } = call('?teams=100,200');
		const data = await result;
		expect(data.view.history).toBe(true);
		expect(data.view.meetings.map((meeting) => meeting.key)).toEqual(['q1', 'q3']);
		expect(data.view.fit?.alliances.map((entry) => entry.teams)).toEqual([[100, 200]]);
		expect(data.trend).toEqual([
			{ number: 100, points: [] },
			{ number: 200, points: [] }
		]);
		expect(setHeaders).toHaveBeenCalledWith({
			'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600'
		});
	});

	it('suggests teams when fewer than two are picked', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue({
			generatedAt: 1,
			teams: [100, 7, 8].map((team, index) => ({
				team,
				opr: 100 - index,
				parts: { auto: 1, hive: 1, flower: 1, garden: 1, park: 1, tips: 1 },
				matches: 5,
				events: 1,
				rank: index + 1,
				percentile: 0.5,
				region: null
			}))
		});
		server.recordNames.mockResolvedValue({ teams: { 7: 'Seven' }, events: {} });
		const data = await call('?teams=100').result;
		expect(data.suggestions).toEqual([
			{ number: 7, name: 'Seven' },
			{ number: 8, name: null }
		]);
		expect(server.loadSeasonModelWithin).not.toHaveBeenCalled();
	});

	it('shows an empty picker without loading anything', async () => {
		const data = await call('').result;
		expect(data.view.teams).toEqual([]);
		expect(server.loadTeamSeason).not.toHaveBeenCalled();
	});
});
