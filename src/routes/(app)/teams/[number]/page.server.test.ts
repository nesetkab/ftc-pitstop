import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventAnalysis, SeasonRatings } from '#lib/analysis/types.ts';
import { eventSummary, teamSeason } from '#lib/components/team/fixtures.ts';
import { DataError } from '#lib/server/errors.ts';
import type { TeamSeason, TeamSeasonEvent } from '#lib/types.ts';
import { load } from './+page.server.ts';

const server = vi.hoisted(() => ({
	loadTeamSeason: vi.fn(),
	loadEventBundle: vi.fn(),
	loadSeasonRatings: vi.fn(),
	loadEventAnalysis: vi.fn()
}));

vi.mock('#lib/server/event.ts', () => ({
	loadTeamSeason: server.loadTeamSeason,
	loadEventBundle: server.loadEventBundle
}));

vi.mock('#lib/server/analysis.ts', () => ({
	loadSeasonRatings: server.loadSeasonRatings,
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
	server.loadSeasonRatings.mockResolvedValue(null);
	server.loadEventAnalysis.mockResolvedValue(null);
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

	it('uses season ratings when they exist', async () => {
		server.loadTeamSeason.mockResolvedValue(season([played('AAA', '2026-11-07')]));
		server.loadSeasonRatings.mockResolvedValue(ratings);
		const { view } = await call().result;
		expect(view.source).toBe('ratings');
		expect(view.stats).toMatchObject({ rank: 3, of: 3 });
	});

	it('charts rating history from event analysis', async () => {
		server.loadTeamSeason.mockResolvedValue(season([played('AAA', '2026-11-07')]));
		server.loadSeasonRatings.mockResolvedValue(ratings);
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

	it('only loads analysis for events that have started and bundles for events with playoffs', async () => {
		server.loadTeamSeason.mockResolvedValue(
			season([
				played('MEET', '2026-11-07', 'LeagueMeet'),
				played('QUAL', '2026-11-14'),
				{ ...played('NEXT', '2099-01-01'), stats: null }
			])
		);
		await call().result;
		expect(server.loadEventAnalysis.mock.calls.map(([code]) => code).sort()).toEqual([
			'MEET',
			'QUAL'
		]);
		expect(server.loadEventBundle.mock.calls.map(([code]) => code)).toEqual(['QUAL']);
	});

	it('still renders when the event details cannot be loaded', async () => {
		server.loadTeamSeason.mockResolvedValue(season([played('QUAL', '2026-11-14')]));
		server.loadSeasonRatings.mockRejectedValue(new Error('broken'));
		server.loadEventAnalysis.mockRejectedValue(new Error('broken'));
		const { view } = await call().result;
		expect(view.source).toBe('scout');
	});
});
