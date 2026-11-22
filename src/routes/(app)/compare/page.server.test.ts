import { beforeEach, describe, expect, it, vi } from 'vitest';
import { teamEvent, teamSeason } from '#lib/components/team/fixtures.ts';
import { load } from './+page.server.ts';

const server = vi.hoisted(() => ({
	loadTeamSeason: vi.fn(),
	loadEventBundle: vi.fn(),
	loadSeasonRatingsWithin: vi.fn(),
	recordNames: vi.fn()
}));

vi.mock('#lib/server/event.ts', () => ({
	loadTeamSeason: server.loadTeamSeason,
	loadEventBundle: server.loadEventBundle
}));
vi.mock('#lib/server/analysis.ts', () => ({
	loadSeasonRatingsWithin: server.loadSeasonRatingsWithin
}));
vi.mock('#lib/server/records.ts', () => ({ recordNames: server.recordNames }));

type Result = {
	numbers: number[];
	missing: number[];
	suggestions: { number: number; name: string | null }[];
	view: { teams: { number: number }[]; shared: { code: string }[] };
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
	server.loadEventBundle.mockResolvedValue({ matches: [] });
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

	it('loads each team once and only the events they shared', async () => {
		const { result, setHeaders } = call('?teams=100,200,404');
		const data = await result;
		expect(data.numbers).toEqual([100, 200]);
		expect(data.missing).toEqual([404]);
		expect(data.view.shared.map((event) => event.code)).toEqual(['BBB']);
		expect(server.loadEventBundle).toHaveBeenCalledExactlyOnceWith('BBB');
		expect(data.suggestions).toEqual([]);
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
		expect(server.loadEventBundle).not.toHaveBeenCalled();
	});

	it('shows an empty picker without loading anything', async () => {
		const data = await call('').result;
		expect(data.view.teams).toEqual([]);
		expect(server.loadTeamSeason).not.toHaveBeenCalled();
	});
});
