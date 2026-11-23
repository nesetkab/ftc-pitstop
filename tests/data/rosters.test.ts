import { describe, expect, it, vi } from 'vitest';
import type { SeasonRatings } from '#lib/analysis/types.ts';
import { createCache, redisStore } from '#lib/server/cache.ts';
import {
	createRosters,
	packRosters,
	ROSTERS_KEY,
	unpackRosters,
	type ScoutRosters
} from '#lib/server/rosters.ts';
import { createStrength, STRENGTH_KEY } from '#lib/server/strength.ts';
import type { EventSummary } from '#lib/types.ts';
import { createFakeRedis, type FakeRedis } from '#lib/workspace/fake-redis.ts';
import { loadTeamCounts } from '../../src/routes/(app)/events/team-counts.server.ts';

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

const numbers = Array.from({ length: 10 }, (_, at) => at + 1);

const scout: ScoutRosters = {
	eventsSearch: [
		{
			code: 'usazgiq',
			teams: numbers.map((teamNumber) => ({ teamNumber, stats: teamNumber <= 3 ? {} : null }))
		}
	]
};

const ratings: SeasonRatings = {
	generatedAt: NOW - 1000,
	teams: numbers.map((team) => ({
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
	const fetchRosters = vi.fn(async () => scout);
	const cache = createCache({
		store: redisStore(redis),
		onError: () => {},
		now,
		background: () => {}
	});
	const { loadRosters } = createRosters({ cache, fetchRosters });
	const strength = createStrength({
		cache,
		loadRosters,
		loadSeasonEvents: async () => ({ events: [event] }),
		loadSeasonRatings: async () => ratings,
		now
	});
	const eventsPage = () =>
		Promise.all([loadTeamCounts(loadRosters), strength.loadStrengthWithin()]);
	return { eventsPage, fetchRosters, loadRosters };
}

describe('season rosters', () => {
	it('packs played teams as negative numbers and unpacks them again', () => {
		const packed = packRosters(scout);
		expect(packed).toEqual({ USAZGIQ: [-1, -2, -3, 4, 5, 6, 7, 8, 9, 10] });
		expect(unpackRosters(packed)).toEqual({
			USAZGIQ: { registered: numbers, played: [1, 2, 3] }
		});
	});

	it('feeds team counts and the strength index from one upstream call', async () => {
		const redis = createFakeRedis(() => NOW);
		const page = instance(redis, { now: NOW });
		const [counts, strength] = await page.eventsPage();
		expect(counts?.USAZGIQ).toEqual({ registered: 10, played: 3 });
		expect(strength?.events.get('USAZGIQ')?.teams).toBe(10);
		expect(page.fetchRosters).toHaveBeenCalledTimes(1);
		expect(redis.keys().sort()).toEqual([
			`pitstop:cache:${ROSTERS_KEY}`,
			`pitstop:cache:${STRENGTH_KEY}`
		]);
	});

	it('refreshes once an hour no matter how many pages ask', async () => {
		const redis = createFakeRedis(() => NOW);
		const clock = { now: NOW };
		const page = instance(redis, clock);
		await page.eventsPage();
		await page.eventsPage();
		expect(page.fetchRosters).toHaveBeenCalledTimes(1);
		clock.now += HOUR_MS + 1;
		await Promise.all([page.eventsPage(), page.eventsPage()]);
		await vi.waitFor(() => expect(page.fetchRosters).toHaveBeenCalledTimes(2));
		await page.eventsPage();
		expect(page.fetchRosters).toHaveBeenCalledTimes(2);
	});

	it('reads one batch on a fresh instance and never calls upstream', async () => {
		const redis = createFakeRedis(() => NOW);
		const clock = { now: NOW };
		await instance(redis, clock).eventsPage();
		const fresh = instance(redis, clock);
		const before = redis.calls.length;
		await fresh.eventsPage();
		expect(redis.calls.slice(before).filter((call) => call !== 'set')).toEqual(['mget']);
		await fresh.eventsPage();
		expect(redis.calls.length).toBe(before + 1);
		expect(fresh.fetchRosters).not.toHaveBeenCalled();
	});
});
