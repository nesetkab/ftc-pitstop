import { describe, expect, it } from 'vitest';
import { teamSeason } from '#lib/components/team/fixtures.ts';
import { createAnalysis } from '#lib/server/analysis.ts';
import { createCache, redisStore } from '#lib/server/cache.ts';
import { createCompare } from '#lib/server/compare.ts';
import { createLoaders } from '#lib/server/event.ts';
import { createFtcClient } from '#lib/server/ftc/client.ts';
import { createFtcScoutClient } from '#lib/server/ftcscout.ts';
import { createNexusClient } from '#lib/server/nexus.ts';
import { createFakeRedis, type FakeRedis } from '#lib/workspace/fake-redis.ts';
import { bundleFor, seasonMatchesOf } from '../analysis/helpers.ts';
import { fixtureFetch } from './helpers.ts';

const LIVE = Date.parse('2026-11-19T12:00:00Z');
const WEEK = '2026-11-03';
const earlier = seasonMatchesOf(await bundleFor('USAZGIQ'), 'USAZXXQ', '2026-11-07');
const [first, second] = earlier[0].red.teams;

const scoutFetch = (async () => Response.json({ data: { eventsSearch: [] } })) as typeof fetch;

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
	return createCompare({
		loadTeamSeason: loaders.loadTeamSeason,
		loadSeasonRatingsWithin: () => analysis.loadSeasonRatingsWithin(5_000),
		loadSeasonModelWithin: () => analysis.loadSeasonModelWithin(5_000),
		recordNames: async () => ({ teams: {}, events: {} })
	});
}

async function seed(redis: FakeRedis) {
	await instance(redis)([first, second]);
	const week = { body: earlier, lastModified: null, fetchedAt: LIVE };
	await redis.set(`pitstop:cache:scout:2026:matches:v2:${WEEK}`, JSON.stringify(week), {
		ex: 3600
	});
	for (const number of [first, second]) {
		const entry = { body: teamSeason(number, `Team ${number}`), lastModified: null, fetchedAt: LIVE };
		await redis.set(`pitstop:cache:scout:2026:team:${number}`, JSON.stringify(entry), {
			ex: 3600
		});
	}
}

describe('redis commands for a compare page', () => {
	it('reads teams, ratings and season matches in one batch and nothing once warm', async () => {
		const redis = createFakeRedis(() => LIVE);
		await seed(redis);
		const compare = instance(redis);
		const before = redis.calls.length;
		const result = await compare([first, second]);
		const reads = redis.calls.slice(before).filter((call) => call !== 'set');
		expect(reads).toEqual(['mget']);
		expect(result.view.history).toBe(true);
		expect(result.view.meetings.length).toBeGreaterThan(0);
		expect(result.view.fit?.alliances).toHaveLength(1);

		const warm = redis.calls.length;
		await compare([first, second]);
		expect(redis.calls.slice(warm)).toEqual([]);
	});
});
