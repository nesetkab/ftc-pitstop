import { describe, expect, it } from 'vitest';
import { createAnalysis } from '#lib/server/analysis.ts';
import { createCache, redisStore } from '#lib/server/cache.ts';
import { createLoaders } from '#lib/server/event.ts';
import { createFtcClient } from '#lib/server/ftc/client.ts';
import { createFtcScoutClient } from '#lib/server/ftcscout.ts';
import { createNexusClient } from '#lib/server/nexus.ts';
import { createSimulate } from '#lib/server/simulate.ts';
import { createFakeRedis, type FakeRedis } from '#lib/workspace/fake-redis.ts';
import { bundleFor, seasonMatchesOf } from '../analysis/helpers.ts';
import { fixtureFetch, scoutSeasonList } from './helpers.ts';

const LIVE = Date.parse('2026-11-19T12:00:00Z');
const WEEK = '2026-11-03';
const earlier = seasonMatchesOf(await bundleFor('USAZGIQ'), 'USAZXXQ', '2026-11-07');
const red = earlier[0].red.teams;
const blue = earlier[0].blue.teams;

const scoutFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
	const body = JSON.parse(String(init?.body ?? '{}')) as { variables?: { start?: string } };
	const data = body.variables?.start
		? { data: { eventsSearch: [] } }
		: scoutSeasonList('USAZGIQ', 'USAZCMP');
	return Response.json(data);
}) as typeof fetch;

function instance(redis: FakeRedis) {
	const now = () => LIVE;
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
	const analysis = createAnalysis({ loaders, cache, now, background: () => {} });
	return createSimulate({
		loadSeasonModelWithin: () => analysis.loadSeasonModelWithin(5_000),
		recordNames: async () => ({ teams: {}, events: {} }),
		now
	});
}

describe('redis commands for the match simulator', () => {
	it('reads the season in one batch and nothing once warm', async () => {
		const redis = createFakeRedis(() => LIVE);
		await instance(redis)({ red, blue });
		const week = { body: earlier, lastModified: null, fetchedAt: LIVE };
		await redis.set(`pitstop:cache:scout:2026:matches:v2:${WEEK}`, JSON.stringify(week), {
			ex: 3600
		});
		const simulate = instance(redis);
		const before = redis.calls.length;
		const result = await simulate({ red, blue });
		const reads = redis.calls.slice(before).filter((call) => call !== 'set');
		expect(reads).toEqual(['mget']);
		expect(result.simulation).not.toBeNull();

		const warm = redis.calls.length;
		await simulate({ red: blue, blue: red });
		expect(redis.calls.slice(warm)).toEqual([]);
	});
});
