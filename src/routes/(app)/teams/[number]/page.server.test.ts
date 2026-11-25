import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventAnalysis, SeasonRatings } from '#lib/analysis/types.ts';
import { eventSummary, teamSeason } from '#lib/components/team/fixtures.ts';
import { DataError } from '#lib/server/errors.ts';
import type { TeamSeason, TeamSeasonEvent } from '#lib/types.ts';
import { load } from './+page.server.ts';

const server = vi.hoisted(() => ({
	loadTeamSeason: vi.fn(),
	loadBannerHistory: vi.fn(),
	loadEventBundle: vi.fn(),
	loadSeasonRatingsWithin: vi.fn(),
	loadEventAnalysis: vi.fn()
}));

vi.mock('#lib/server/event.ts', () => ({
	loadTeamSeason: server.loadTeamSeason,
	loadBannerHistory: server.loadBannerHistory,
	loadEventBundle: server.loadEventBundle
}));

vi.mock('#lib/server/analysis.ts', () => ({
	loadSeasonRatingsWithin: server.loadSeasonRatingsWithin,
	loadEventAnalysis: server.loadEventAnalysis
}));

const stats = {
	rank: 3,
	rs: 3,
	tbp: 80,
	avgTips: 2,
	wins: 4,
	losses: 1,
	ties: 0,
	dq: 0,
	played: 5,
	opr: { total: 40, auto: 10, teleop: 30 }
};

function played(code: string, start: string, type: 'Qualifier' | 'LeagueMeet' = 'Qualifier') {
	return {
		event: eventSummary({ code, start, end: start, type, typeName: type }),
		stats,
		awards: []
	} satisfies TeamSeasonEvent;
}

function season(events: TeamSeasonEvent[]): TeamSeason {
	return teamSeason(26670, 'SCA Iron Eagles', events);
}

function call(number = '26670') {
	const setHeaders = vi.fn();
	const result = load({ params: { number }, setHeaders } as never) as Promise<{
		view: { source: string; stats: { rank: number | null; of: number | null }; charts: unknown[] };
	}>;
	return { result, setHeaders };
}

const ratings: SeasonRatings = {
	generatedAt: 1,
	teams: [10, 20, 26670].map((team, index) => ({
		team,
		opr: 80 - index * 20,
		parts: { auto: 10, hive: 20, flower: 1, garden: 1, park: 3, tips: 1 },
		matches: 8,
		events: 1,
		rank: index + 1,
		percentile: 0.5,
		region: 'USAZ'
	}))
};

beforeEach(() => {
	for (const mock of Object.values(server)) mock.mockReset();
	server.loadSeasonRatingsWithin.mockResolvedValue(null);
	server.loadEventAnalysis.mockResolvedValue(null);
	server.loadBannerHistory.mockResolvedValue([]);
	server.loadEventBundle.mockRejectedValue(new DataError(503, 'down'));
});

describe('team page load', () => {
	it('answers 404 for a team that does not exist', async () => {
		server.loadTeamSeason.mockResolvedValue(null);
		await expect(call('99999').result).rejects.toMatchObject({ status: 404 });
	});

	it('passes data errors on with their status', async () => {
		server.loadTeamSeason.mockRejectedValue(new DataError(404, 'Team not found'));
		await expect(call('abc').result).rejects.toMatchObject({ status: 404 });
		server.loadTeamSeason.mockRejectedValue(new DataError(503, 'Team data is unavailable'));
		await expect(call().result).rejects.toMatchObject({ status: 503 });
	});

	it('falls back to FTCScout numbers when season ratings and analysis are missing', async () => {
		server.loadTeamSeason.mockResolvedValue(season([played('AAA', '2026-11-07')]));
		const { result, setHeaders } = call();
		const { view } = await result;
		expect(view.source).toBe('scout');
		expect(view.charts).toHaveLength(1);
		expect(setHeaders).toHaveBeenCalledWith({
			'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600'
		});
	});

	it('asks for past banners with the rookie year and shows them', async () => {
		server.loadTeamSeason.mockResolvedValue(season([played('AAA', '2026-11-07')]));
		server.loadBannerHistory.mockResolvedValue([
			{
				season: 2025,
				code: 'OLD',
				event: 'Old Championship',
				start: '2026-02-21',
				award: { id: 13, name: 'Winning Alliance', placement: 1, team: 26670, person: null }
			}
		]);
		const { view } = (await call().result) as unknown as {
			view: { banners: { season: string; event: string }[] };
		};
		expect(server.loadBannerHistory).toHaveBeenCalledWith(26670, 2024);
		expect(view.banners).toMatchObject([{ season: '2025-26', event: 'Old Championship' }]);
	});

	it('still loads when past banners fail', async () => {
		server.loadTeamSeason.mockResolvedValue(season([played('AAA', '2026-11-07')]));
		server.loadBannerHistory.mockRejectedValue(new DataError(503, 'down'));
		const { view } = (await call().result) as unknown as { view: { banners: unknown[] } };
		expect(view.banners).toEqual([]);
	});

	it('uses season ratings when they exist', async () => {
		server.loadTeamSeason.mockResolvedValue(season([played('AAA', '2026-11-07')]));
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings);
		const { view } = await call().result;
		expect(view.source).toBe('ratings');
		expect(view.stats).toMatchObject({ rank: 3, of: 3 });
	});

	it('charts rating history from event analysis', async () => {
		server.loadTeamSeason.mockResolvedValue(season([played('AAA', '2026-11-07')]));
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings);
		const analysis = {
			code: 'AAA',
			ratings: [
				{
					team: 26670,
					opr: 40,
					parts: {},
					matches: 2,
					rank: 1,
					prior: 30,
					history: [
						{ key: 'q1', time: 1, opr: 31 },
						{ key: 'q2', time: 2, opr: 35 }
					]
				}
			]
		} as unknown as EventAnalysis;
		server.loadEventAnalysis.mockResolvedValue(analysis);
		const { view } = await call().result;
		expect(server.loadEventAnalysis).toHaveBeenCalledWith('AAA');
		expect(view.charts).toHaveLength(1);
		expect(view.charts[0]).toMatchObject({ id: 'AAA' });
	});

	it('loads analysis for started events and only the team list for unscheduled ones', async () => {
		server.loadTeamSeason.mockResolvedValue(
			season([
				played('MEET', '2026-11-07', 'LeagueMeet'),
				played('QUAL', '2026-11-14'),
				{ ...played('NEXT', '2099-01-01'), stats: null },
				{ ...played('PAST', '2026-01-01'), stats: null }
			])
		);
		server.loadEventBundle.mockResolvedValue({ teams: [], matches: [], alliances: [] });
		await call().result;
		expect(server.loadEventAnalysis.mock.calls.map(([code]) => code).sort()).toEqual([
			'MEET',
			'QUAL'
		]);
		expect(server.loadEventBundle.mock.calls.map(([code]) => code).sort()).toEqual([
			'MEET',
			'NEXT',
			'QUAL'
		]);
	});

	it('projects upcoming events once their schedule is out', async () => {
		server.loadTeamSeason.mockResolvedValue(
			season([played('QUAL', '2026-11-14'), { ...played('NEXT', '2099-01-01'), stats: null }])
		);
		server.loadSeasonRatingsWithin.mockResolvedValue(ratings);
		const scheduledBundle = {
			teams: [{ number: 26670 }, { number: 10 }],
			alliances: [],
			matches: [
				{
					key: 'q1',
					level: 'qual',
					red: [{ team: 26670 }],
					blue: [{ team: 10 }],
					result: null
				}
			]
		};
		server.loadEventBundle.mockImplementation(async (code: string) =>
			code === 'NEXT' ? scheduledBundle : { teams: [], matches: [], alliances: [] }
		);
		server.loadEventAnalysis.mockImplementation(async (code: string) =>
			code === 'NEXT'
				? {
						ratings: [],
						projections: [
							{ team: 26670, expectedRank: 1.4, top8: 1, top4: 1, rankChances: [], expectedRs: 2 },
							{ team: 10, expectedRank: 1.6, top8: 1, top4: 1, rankChances: [], expectedRs: 2 }
						]
					}
				: null
		);
		const { view } = (await call().result) as unknown as {
			view: { upcoming: { code: string; kind: string; outlook: string }[] };
		};
		expect(server.loadEventAnalysis.mock.calls.map(([code]) => code).sort()).toEqual([
			'NEXT',
			'QUAL'
		]);
		expect(view.upcoming).toEqual([
			expect.objectContaining({ code: 'NEXT', kind: 'projection', outlook: 'Expected rank 1 of 2' })
		]);
	});

	it('still renders when the event details cannot be loaded', async () => {
		server.loadTeamSeason.mockResolvedValue(season([played('QUAL', '2026-11-14')]));
		server.loadSeasonRatingsWithin.mockRejectedValue(new Error('broken'));
		server.loadEventAnalysis.mockRejectedValue(new Error('broken'));
		const { view } = await call().result;
		expect(view.source).toBe('scout');
	});
});
