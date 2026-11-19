import { describe, expect, it, vi } from 'vitest';
import { createCache } from '#lib/server/cache.ts';
import { DataError } from '#lib/server/errors.ts';
import { createLoaders, eventTier, policyFor } from '#lib/server/event.ts';
import { createFtcClient } from '#lib/server/ftc/client.ts';
import { createFtcScoutClient } from '#lib/server/ftcscout.ts';
import { createNexusClient } from '#lib/server/nexus.ts';
import { fixtureFetch, scoutFetch, scoutFixture } from './helpers.ts';

interface Setup {
	now: string;
	ftcFetch?: typeof fetch;
	failPaths?: RegExp;
	scout?: Record<string, string | object>;
	credentials?: boolean;
	nexusFetch?: typeof fetch;
}

function setup(options: Setup) {
	let time = Date.parse(options.now);
	const ftcFixtures = fixtureFetch({ failPaths: options.failPaths });
	const scout = scoutFetch(options.scout ?? {});
	const ftc = createFtcClient({
		username: options.credentials === false ? undefined : 'tester',
		apiKey: options.credentials === false ? undefined : 'not-a-real-key',
		fetch: options.ftcFetch ?? ftcFixtures.fetch,
		sleep: async () => {}
	});
	const loaders = createLoaders({
		ftc,
		scout: createFtcScoutClient({ fetch: scout.fetch, sleep: async () => {} }),
		nexus: createNexusClient({
			apiKey: options.nexusFetch ? 'nexus-key' : undefined,
			fetch: options.nexusFetch
		}),
		cache: createCache({ onError: () => {}, now: () => time }),
		now: () => time
	});
	return {
		...loaders,
		ftcCalls: ftcFixtures.calls,
		scoutCalls: scout.bodies,
		advance: (seconds: number) => {
			time += seconds * 1000;
		}
	};
}

const paths = (calls: { url: string }[]) =>
	calls.map((call) => call.url.replace('https://ftc-api.firstinspires.org/v2.0/2026/', ''));

describe('loadEventBundle', () => {
	it('builds the full bundle for a finished event', async () => {
		const data = setup({ now: '2026-11-19T12:00:00Z' });
		const bundle = await data.loadEventBundle('usazgiq');
		expect(bundle.event.code).toBe('USAZGIQ');
		expect(bundle).toMatchObject({
			phase: 'done',
			source: 'ftc',
			stale: false,
			cacheControl: 'public, s-maxage=86400'
		});
		expect(bundle.teams).toHaveLength(27);
		expect(bundle.matches).toHaveLength(44);
		expect(bundle.matches.every((match) => match.result?.red.breakdown)).toBe(true);
		expect(bundle.rankings[0]).toMatchObject({ rank: 1, team: 26670 });
		expect(bundle.alliances).toHaveLength(6);
		expect(bundle.awards.length).toBeGreaterThan(10);
		expect(bundle.advancement).toMatchObject({ advancesTo: 'USAZCMP', slots: 5 });
		expect(bundle.fetchedAt).toBe(Date.parse('2026-11-19T12:00:00Z'));
		const before = data.ftcCalls.length;
		await data.loadEventBundle('USAZGIQ');
		expect(data.ftcCalls.length).toBe(before);
	});

	it('only asks for the schedule and teams before an event starts', async () => {
		const data = setup({ now: '2026-11-19T12:00:00Z' });
		const bundle = await data.loadEventBundle('USMTBUQ');
		expect(bundle).toMatchObject({
			phase: 'upcoming',
			matches: [],
			rankings: [],
			alliances: [],
			awards: [],
			advancement: null,
			cacheControl: 'public, s-maxage=300, stale-while-revalidate=3600'
		});
		expect(bundle.teams).toHaveLength(32);
		expect(paths(data.ftcCalls).sort()).toEqual([
			'events?eventCode=USMTBUQ',
			'schedule/USMTBUQ/playoff/hybrid',
			'schedule/USMTBUQ/qual/hybrid',
			'teams?eventCode=USMTBUQ'
		]);
	});

	it('uses short ttls and If-Modified-Since while an event is live', async () => {
		const data = setup({ now: '2026-11-14T19:00:00Z' });
		const bundle = await data.loadEventBundle('USAZGIQ');
		expect(bundle.cacheControl).toBe('public, s-maxage=300, stale-while-revalidate=3600');
		expect(eventTier(bundle.event, Date.parse('2026-11-14T19:00:00Z'))).toBe('live');
		data.advance(400);
		await data.loadEventBundle('USAZGIQ');
		await vi.waitFor(() => {
			const conditional = data.ftcCalls.filter((call) => call.headers['if-modified-since']);
			expect(conditional.length).toBeGreaterThan(0);
		});
		const again = await data.loadEventBundle('USAZGIQ');
		expect(again.matches).toHaveLength(44);
		expect(again.stale).toBe(false);
	});

	it('reports a missing event as not found', async () => {
		const data = setup({ now: '2026-11-19T12:00:00Z' });
		await expect(data.loadEventBundle('NOPE123')).rejects.toMatchObject({
			status: 404,
			message: 'Event not found'
		});
		await expect(data.loadEventBundle('../etc')).rejects.toBeInstanceOf(DataError);
	});

	it('keeps going with schedule totals when score details fail', async () => {
		const data = setup({ now: '2026-11-19T12:00:00Z', failPaths: /scores\// });
		const bundle = await data.loadEventBundle('USAZGIQ');
		expect(bundle.stale).toBe(true);
		expect(bundle.matches).toHaveLength(44);
		expect(bundle.matches[0].result).toMatchObject({ red: { total: 89, breakdown: null } });
	});

	it('falls back to FTCScout when the FTC API is down', async () => {
		const data = setup({
			now: '2026-11-19T12:00:00Z',
			failPaths: /ftc-api/,
			scout: { EventByCode: 'event-USAZGIQ' }
		});
		const bundle = await data.loadEventBundle('USAZGIQ');
		expect(bundle).toMatchObject({ source: 'ftcscout', stale: true, phase: 'done' });
		const ftc = await setup({ now: '2026-11-19T12:00:00Z' }).loadEventBundle('USAZGIQ');
		expect(bundle.matches.map((match) => match.key)).toEqual(ftc.matches.map((match) => match.key));
		expect(bundle.matches.map((match) => match.result?.red.total)).toEqual(
			ftc.matches.map((match) => match.result?.red.total)
		);
		expect(bundle.rankings.map((ranking) => [ranking.team, ranking.rs, ranking.avgAuto])).toEqual(
			ftc.rankings.map((ranking) => [ranking.team, ranking.rs, ranking.avgAuto])
		);
		expect(bundle.matches[0].scheduledTime).toBe(ftc.matches[0].scheduledTime);
	});

	it('falls back to FTCScout when credentials are missing', async () => {
		const data = setup({
			now: '2026-11-19T12:00:00Z',
			credentials: false,
			scout: { EventByCode: 'event-USALATQ' }
		});
		const bundle = await data.loadEventBundle('USALATQ');
		expect(bundle.source).toBe('ftcscout');
		expect(
			bundle.matches.filter((match) => match.level === 'playoff').map((match) => match.label)
		).toEqual(['F1', 'F2']);
		expect(data.ftcCalls).toHaveLength(0);
	});

	it('reports an outage when both sources fail', async () => {
		const data = setup({ now: '2026-11-19T12:00:00Z', failPaths: /ftc-api/ });
		await expect(data.loadEventBundle('USAZGIQ')).rejects.toMatchObject({ status: 503 });
	});
});

describe('policies', () => {
	it('picks short ttls live and long ttls after the event', () => {
		expect(policyFor('scheduleQual', 'live', 'quals')).toEqual({ ttl: 15, maxStale: 300 });
		expect(policyFor('scoresQual', 'live', null).ttl).toBe(20);
		expect(policyFor('scoresQual', 'live', 'done').ttl).toBe(300);
		expect(policyFor('scoresQual', 'finished', 'done').ttl).toBe(86_400);
		expect(policyFor('scheduleQual', 'upcoming', null).ttl).toBe(600);
	});
});

describe('season loaders', () => {
	const onDate = scoutFixture<{ data: { eventsOnDate: unknown[] } }>('events-on-2026-11-14');
	const season = { data: { eventsSearch: onDate.data.eventsOnDate } };

	it('loads the season event list and events happening today', async () => {
		const data = setup({ now: '2026-11-14T18:00:00Z', scout: { EventsSearch: season } });
		const list = await data.loadSeasonEvents();
		expect(list.events.length).toBe(onDate.data.eventsOnDate.length);
		expect(list.events.find((event) => event.code === 'USAZGIQ')).toMatchObject({
			type: 'Qualifier',
			city: 'Gilbert',
			timezone: 'America/Phoenix',
			hasMatches: true
		});
		const today = await data.loadEventsToday();
		expect(today.some((event) => event.code === 'USAZGIQ')).toBe(true);
		expect(today.every((event) => event.start <= '2026-11-15' && event.end >= '2026-11-14')).toBe(
			true
		);
	});

	it('falls back to the FTC season list', async () => {
		const ftcFetch = (async () =>
			Response.json({
				events: [
					{
						code: 'USAZGIQ',
						name: 'Roadrunner - Gilbert Qualifier',
						type: '2',
						typeName: 'Qualifier',
						timezone: 'America/Phoenix',
						dateStart: '2026-11-14T00:00:00',
						dateEnd: '2026-11-14T00:00:00'
					}
				]
			})) as typeof fetch;
		const data = setup({ now: '2026-11-14T18:00:00Z', ftcFetch });
		const list = await data.loadSeasonEvents();
		expect(list).toMatchObject({
			stale: true,
			events: [{ code: 'USAZGIQ', hasMatches: null, type: 'Qualifier' }]
		});
	});

	it('loads a team season and returns null for unknown teams', async () => {
		const data = setup({ now: '2026-11-19T12:00:00Z', scout: { TeamSeason: 'team-2844' } });
		const season2844 = await data.loadTeamSeason('2844');
		expect(season2844?.team).toMatchObject({ number: 2844, name: 'Valley X Robotics' });
		expect(season2844?.events[0]).toMatchObject({
			event: { code: 'USAZGIQ' },
			stats: { rank: 16, rs: 1.8 }
		});
		expect(season2844?.events[0].awards[0]).toMatchObject({ name: 'Inspire Award', placement: 3 });
		expect(season2844?.previousQuickStats?.season).toBe(2025);
		const missing = setup({ now: '2026-11-19T12:00:00Z', scout: { TeamSeason: 'team-missing' } });
		expect(await missing.loadTeamSeason(999998)).toBeNull();
		await expect(missing.loadTeamSeason('abc')).rejects.toMatchObject({ status: 404 });
	});

	it('builds a search index from FTC teams and the season list', async () => {
		const ftcFetch = (async (input: RequestInfo | URL) => {
			const page = Number(new URL(String(input)).searchParams.get('page'));
			const teams =
				page === 1
					? [
							{
								teamNumber: 2844,
								nameShort: 'Valley X Robotics',
								city: 'Chandler',
								stateProv: 'AZ',
								country: 'USA'
							}
						]
					: [
							{
								teamNumber: 99999,
								nameShort: 'Off-Season Demo Team',
								city: '',
								stateProv: '',
								country: ''
							}
						];
			return Response.json({ teams, pageTotal: 2, teamCountTotal: 2 });
		}) as typeof fetch;
		const data = setup({ now: '2026-11-14T18:00:00Z', ftcFetch, scout: { EventsSearch: season } });
		const index = await data.searchIndex();
		expect(index.teams).toEqual([
			{ number: 2844, name: 'Valley X Robotics', city: 'Chandler', state: 'AZ', country: 'USA' }
		]);
		expect(index.events.length).toBeGreaterThan(10);
	});

	it('batches previous season quick stats and caches them per team', async () => {
		const data = setup({ now: '2026-11-19T12:00:00Z', scout: { QuickStats: 'quick-stats-2025' } });
		const stats = await data.loadPriorQuickStats([2844, 18420, 26670, 999998, 2844]);
		expect([...stats.keys()].sort()).toEqual([2844, 18420, 26670].sort());
		expect(stats.get(18420)?.total.value).toBeCloseTo(166.636, 2);
		expect(data.scoutCalls).toHaveLength(1);
		expect(data.scoutCalls[0].query).toContain('t18420: teamByNumber(number: 18420)');
		await data.loadPriorQuickStats([2844, 18420]);
		expect(data.scoutCalls).toHaveLength(1);
	});

	it('loads season matches week by week without duplicates', async () => {
		const data = setup({
			now: '2026-09-21T12:00:00Z',
			scout: { EventsSearch: 'season-matches-2026-09-19' }
		});
		const result = await data.loadSeasonMatches({ from: '2026-09-13', to: '2026-09-20' });
		expect(data.scoutCalls.map((call) => call.variables)).toEqual([
			{ season: 2026, start: '2026-09-13', end: '2026-09-26' },
			{ season: 2026, start: '2026-09-20', end: '2026-10-03' }
		]);
		expect(result.matches.map((match) => `${match.eventCode} ${match.key}`)).toEqual([
			'USUTSAS1 p1',
			'USUTSAS1 p2'
		]);
		expect(result.matches[0]).toMatchObject({
			level: 'playoff',
			red: { total: 39, teams: [20515] }
		});
	});
});

describe('loadQueueStatus', () => {
	it('returns null without a Nexus key and maps queue data with one', async () => {
		expect(await setup({ now: '2026-11-19T12:00:00Z' }).loadQueueStatus('USAZGIQ')).toBeNull();
		const nexusFetch = vi.fn(async () =>
			Response.json({
				eventKey: '2026usazgiq',
				dataAsOfTime: 1,
				nowQueuing: 'Qualification 3',
				matches: [
					{
						label: 'Qualification 3',
						status: 'Now queuing',
						redTeams: ['26670', '32043'],
						blueTeams: ['26128', null],
						times: { estimatedStartTime: 5 }
					}
				],
				announcements: []
			})
		) as unknown as typeof fetch;
		const data = setup({ now: '2026-11-19T12:00:00Z', nexusFetch });
		const status = await data.loadQueueStatus('USAZGIQ');
		expect(status?.matches[0]).toMatchObject({
			key: 'q3',
			status: 'now-queuing',
			red: [26670, 32043],
			blue: [26128]
		});
		expect(String((nexusFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toBe(
			'https://ftc.nexus/api/v1/event/2026usazgiq'
		);
	});
});
