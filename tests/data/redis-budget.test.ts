import { describe, expect, it } from 'vitest';
import { eventSummary, teamSeason } from '#lib/components/team/fixtures.ts';
import { createAnalysis } from '#lib/server/analysis.ts';
import { createCache, redisStore } from '#lib/server/cache.ts';
import { createLoaders, teamPolicy } from '#lib/server/event.ts';
import { createHome } from '#lib/server/home.ts';
import { createFtcClient } from '#lib/server/ftc/client.ts';
import { createFtcScoutClient } from '#lib/server/ftcscout.ts';
import { createNexusClient } from '#lib/server/nexus.ts';
import type { EventSummary } from '#lib/types.ts';
import { createFakeRedis, type FakeRedis } from '#lib/workspace/fake-redis.ts';
import { bundleFor, seasonMatchesOf } from '../analysis/helpers.ts';
import { fixtureFetch, scoutSeasonList } from './helpers.ts';

const DAY_MS = 86_400_000;
const LIVE = Date.parse('2026-11-19T12:00:00Z');
const ARCHIVED = Date.parse('2026-12-10T12:00:00Z');
const earlier = seasonMatchesOf(await bundleFor('USAZGIQ'), 'USAZXXQ', '2026-11-07');

const scoutFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
	const body = JSON.parse(String(init?.body ?? '{}')) as { variables?: { start?: string } };
	const data = body.variables?.start
		? { data: { eventsSearch: [] } }
		: scoutSeasonList('USAZGIQ', 'USAZCMP');
	return Response.json(data);
}) as typeof fetch;

function instance(redis: FakeRedis, clock: { now: number }) {
	const now = () => clock.now;
	const cache = createCache({
		store: redisStore(redis),
		onError: () => {},
		now,
		background: () => {}
	});
	const loaders = createLoaders({
		ftc: createFtcClient({
			username: 'tester',
			apiKey: 'not-a-real-key',
			fetch: fixtureFetch().fetch,
			sleep: async () => {}
		}),
		scout: createFtcScoutClient({ fetch: scoutFetch, sleep: async () => {} }),
		nexus: createNexusClient({ apiKey: undefined }),
		cache,
		now
	});
	const analysis = createAnalysis({
		loaders: {
			loadEventBundle: loaders.loadEventBundle,
			loadSeasonMatches: async () => ({
				matches: earlier,
				fetchedAt: clock.now,
				stale: false,
				missing: []
			})
		},
		cache,
		now,
		background: () => {}
	});
	const home = createHome({
		cache,
		loadTeamSeason: loaders.loadTeamSeason,
		loadSeasonRatingsWithin: analysis.loadSeasonRatingsWithin,
		loadSeasonModelWithin: async () => null,
		now
	});
	return {
		loaders,
		analysis,
		home,
		eventPage: async (code: string) => {
			await Promise.all([loaders.loadEventBundle(code), analysis.loadEventAnalysisEntry(code)]);
		}
	};
}

async function commands(redis: FakeRedis, task: () => Promise<unknown>): Promise<string[]> {
	const before = redis.calls.length;
	await task();
	return redis.calls.slice(before);
}

const reads = (calls: string[]) => calls.filter((call) => call !== 'set');

describe('redis commands for an event page view', () => {
	it('reads everything in two batches on a fresh instance and nothing once warm', async () => {
		const redis = createFakeRedis(() => LIVE);
		const clock = { now: LIVE };
		const first = instance(redis, clock);
		const cold = await commands(redis, () => first.eventPage('USAZGIQ'));
		expect(reads(cold)).toEqual(['mget', 'mget']);
		expect(await commands(redis, () => first.eventPage('USAZGIQ'))).toEqual([]);

		const second = instance(redis, clock);
		expect(await commands(redis, () => second.eventPage('USAZGIQ'))).toEqual(['mget', 'mget']);
	});

	it('does not read the event data for codes that do not exist', async () => {
		const redis = createFakeRedis(() => LIVE);
		const page = instance(redis, { now: LIVE });
		await page.eventPage('USAZGIQ');
		await page.eventPage('NOPE1').catch(() => null);
		expect(await commands(redis, () => page.eventPage('NOPE2').catch(() => null))).toEqual([]);
	});

	it('leaves events that ended weeks ago alone for days', async () => {
		const redis = createFakeRedis(() => ARCHIVED);
		const clock = { now: ARCHIVED };
		const page = instance(redis, clock);
		await page.eventPage('USAZGIQ');
		clock.now += 3 * DAY_MS;
		expect(await commands(redis, () => page.eventPage('USAZGIQ'))).toEqual([]);
	});
});

describe('redis commands for season matches', () => {
	it('reads every week in one batch', async () => {
		const redis = createFakeRedis(() => LIVE);
		const clock = { now: LIVE };
		await instance(redis, clock).loaders.loadSeasonMatches();
		const fresh = instance(redis, clock);
		expect(await commands(redis, () => fresh.loaders.loadSeasonMatches())).toEqual(['mget']);
	});
});

describe('redis commands for a filtered leaderboard', () => {
	it('reads season and event ratings in one batch and nothing once warm', async () => {
		const redis = createFakeRedis(() => LIVE);
		const clock = { now: LIVE };
		const both = (page: ReturnType<typeof instance>) =>
			Promise.all([page.analysis.loadSeasonRatings(), page.analysis.loadSeasonEventRatings()]);
		const first = instance(redis, clock);
		await both(first);
		expect(await commands(redis, () => both(first))).toEqual([]);
		const fresh = instance(redis, clock);
		expect(await commands(redis, () => both(fresh))).toEqual(['mget']);
	});
});

describe('redis commands for the home page', () => {
	const today = [
		eventSummary({ code: 'USAZGIQ' }),
		eventSummary({ code: 'USAZXXQ', name: 'Nobody looked at this one' })
	];

	it('reads progress for every event today in one batch without fetching', async () => {
		const redis = createFakeRedis(() => LIVE);
		const clock = { now: LIVE };
		await instance(redis, clock).eventPage('USAZGIQ');
		const fresh = instance(redis, clock);
		let progress: Awaited<ReturnType<typeof fresh.home.loadTodayProgress>> = {};
		const calls = await commands(redis, async () => {
			progress = await fresh.home.loadTodayProgress(today);
		});
		expect(calls).toEqual(['mget']);
		expect(Object.keys(progress)).toEqual(['USAZGIQ']);
		expect(await commands(redis, () => fresh.home.loadTodayProgress(today))).toEqual([]);
		clock.now += 90_000;
		expect(await commands(redis, () => fresh.home.loadTodayProgress(today))).toEqual([]);
		clock.now += 60_000;
		expect(await commands(redis, () => fresh.home.loadTodayProgress(today))).toEqual(['mget']);
	});

	it('reads all followed teams and their ratings in one batch', async () => {
		const redis = createFakeRedis(() => LIVE);
		const clock = { now: LIVE };
		await instance(redis, clock).analysis.loadSeasonRatings();
		for (const [number, name] of [
			[26670, 'SCA Iron Eagles'],
			[3747, 'The Hive']
		] as const) {
			const entry = { body: teamSeason(number, name), lastModified: null, fetchedAt: LIVE };
			await redis.set(`pitstop:cache:scout:2026:team:${number}`, JSON.stringify(entry), {
				ex: 3600
			});
		}
		const fresh = instance(redis, clock);
		let teams: Awaited<ReturnType<typeof fresh.home.loadFollowed>> = [];
		const calls = await commands(redis, async () => {
			teams = await fresh.home.loadFollowed([26670, 3747]);
		});
		expect(calls).toEqual(['mget']);
		expect(teams.map((team) => [team.number, team.name, team.found])).toEqual([
			[26670, 'SCA Iron Eagles', true],
			[3747, 'The Hive', true]
		]);
		expect(await commands(redis, () => fresh.home.loadFollowed([26670, 3747]))).toEqual([]);
	});
});

describe('team season policy', () => {
	const at = (start: string, end: string) => ({ event: { start, end } as EventSummary });

	it('refreshes often only around a team event', () => {
		const now = Date.parse('2026-11-19T12:00:00Z');
		expect(teamPolicy(null, now).ttl).toBe(300);
		expect(teamPolicy({ events: [at('2026-11-20', '2026-11-21')] }, now).ttl).toBe(300);
		expect(teamPolicy({ events: [at('2026-11-14', '2026-11-16')] }, now).ttl).toBe(300);
		expect(teamPolicy({ events: [at('2026-10-04', '2026-10-04')] }, now).ttl).toBe(21_600);
		expect(teamPolicy({ events: [at('2026-12-12', '2026-12-12')] }, now).ttl).toBe(21_600);
	});
});
