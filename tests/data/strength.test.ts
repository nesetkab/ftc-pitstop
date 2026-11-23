import { describe, expect, it, vi } from 'vitest';
import type { SeasonRatings } from '#lib/analysis/types.ts';
import { createCache, redisStore } from '#lib/server/cache.ts';
import { createStrength, STRENGTH_KEY, toRosters } from '#lib/server/strength.ts';
import type { EventSummary } from '#lib/types.ts';
import { createFakeRedis, type FakeRedis } from '#lib/workspace/fake-redis.ts';

const NOW = Date.parse('2026-11-19T18:00:00Z');
const HOUR_MS = 3_600_000;

const event: EventSummary = {
	code: 'USAZGIQ',
	name: 'Gilbert Qualifier',
	type: 'Qualifier',
	typeName: 'Qualifier',
	region: 'USAZ',
	league: null,
	venue: null,
	city: 'Gilbert',
	state: 'AZ',
	country: 'USA',
	timezone: 'America/Phoenix',
	start: '2026-11-28',
	end: '2026-11-28',
	hasMatches: null
};

const teams = Array.from({ length: 10 }, (_, at) => at + 1);

const ratings: SeasonRatings = {
	generatedAt: NOW - 1000,
	teams: teams.map((team) => ({
		team,
		opr: team * 10,
		parts: {} as never,
		matches: 4,
		events: 1,
		rank: 11 - team,
		percentile: 50,
		region: 'USAZ'
	}))
};

function instance(redis: FakeRedis, clock: { now: number }) {
	const now = () => clock.now;
	const loadRosters = vi.fn(async () => ({ USAZGIQ: { registered: teams, played: [] } }));
	const cache = createCache({
		store: redisStore(redis),
		onError: () => {},
		now,
		background: () => {}
	});
	const strength = createStrength({
		cache,
		loadRosters,
		loadSeasonEvents: async () => ({ events: [event] }),
		loadSeasonRatings: async () => ratings,
		now
	});
	return { ...strength, loadRosters };
}

async function commands(redis: FakeRedis, task: () => Promise<unknown>): Promise<string[]> {
	const before = redis.calls.length;
	await task();
	return redis.calls.slice(before).filter((call) => call !== 'set');
}

describe('event strength index', () => {
	it('builds once, stores it under our cache prefix and ranks events', async () => {
		const redis = createFakeRedis(() => NOW);
		const page = instance(redis, { now: NOW });
		const ranked = await page.loadStrength();
		expect(ranked.total).toBe(1);
		expect(ranked.events.get('USAZGIQ')).toEqual({
			top: 65,
			deep: null,
			all: 55,
			rated: 10,
			teams: 10,
			rank: 1
		});
		expect(redis.keys()).toEqual([`pitstop:cache:${STRENGTH_KEY}`]);
		expect(redis.ttl(`pitstop:cache:${STRENGTH_KEY}`)).toBeGreaterThan(HOUR_MS / 1000);
		expect(await page.loadStrength()).toBe(ranked);
		expect(page.loadRosters).toHaveBeenCalledTimes(1);
	});

	it('reads one batch on a fresh instance, nothing once warm, and never fetches upstream', async () => {
		const redis = createFakeRedis(() => NOW);
		const clock = { now: NOW };
		await instance(redis, clock).loadStrength();
		const fresh = instance(redis, clock);
		expect(await commands(redis, () => fresh.loadStrength())).toEqual(['mget']);
		expect(await commands(redis, () => fresh.loadStrength())).toEqual([]);
		expect(fresh.loadRosters).not.toHaveBeenCalled();
	});

	it('serves the old index while it rebuilds after an hour', async () => {
		const redis = createFakeRedis(() => NOW);
		const clock = { now: NOW };
		const page = instance(redis, clock);
		const first = await page.loadStrength();
		clock.now += HOUR_MS + 1;
		expect(await page.loadStrength()).toBe(first);
		await vi.waitFor(() => expect(page.loadRosters).toHaveBeenCalledTimes(2));
	});

	it('gives up quickly on a cold start instead of blocking the page', async () => {
		const redis = createFakeRedis(() => NOW);
		const cache = createCache({ store: redisStore(redis), onError: () => {}, background: () => {} });
		const slow = createStrength({
			cache,
			loadRosters: () => new Promise(() => {}),
			loadSeasonEvents: async () => ({ events: [event] }),
			loadSeasonRatings: async () => ratings
		});
		expect(await slow.loadStrengthWithin(20)).toBeNull();
	});

	it('maps FTCScout rosters to registered and played teams', () => {
		expect(
			toRosters({
				eventsSearch: [
					{
						code: 'usazgiq',
						teams: [
							{ teamNumber: 1, stats: {} },
							{ teamNumber: 2, stats: null }
						]
					}
				]
			})
		).toEqual({ USAZGIQ: { registered: [1, 2], played: [1] } });
	});
});
