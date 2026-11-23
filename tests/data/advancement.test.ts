import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventSummary } from '#lib/components/team/fixtures.ts';
import {
	ADVANCEMENT_KEY,
	advancementKeys,
	createAdvancement
} from '#lib/server/advancement.ts';
import { createCache, redisStore } from '#lib/server/cache.ts';
import type { EventSummary } from '#lib/types.ts';
import { createFakeRedis, type FakeRedis } from '#lib/workspace/fake-redis.ts';

const NOW = Date.parse('2026-11-23T12:00:00Z');
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const events: EventSummary[] = [
	eventSummary({ code: 'USMISOQ', name: 'South Qualifier', region: 'USMI', start: '2026-11-07', end: '2026-11-07' }),
	eventSummary({ code: 'USMINOQ', name: 'North Qualifier', region: 'USMI', start: '2026-11-21', end: '2026-11-21' }),
	eventSummary({ code: 'USMIXQ', name: 'Unvisited Qualifier', region: 'USMI', start: '2026-11-14', end: '2026-11-14' }),
	eventSummary({
		code: 'USMISECMP',
		name: 'Michigan SE Championship',
		type: 'Championship',
		region: 'USMI',
		start: '2026-12-11',
		end: '2026-12-11'
	})
];

function fixture(code: string, name: string): unknown {
	return JSON.parse(readFileSync(`tests/fixtures/ftc/2026/${code}/${name}.json`, 'utf8'));
}

async function seed(redis: FakeRedis, code: string, at: number) {
	const keys = advancementKeys(code);
	for (const [key, name] of [
		[keys.advancement, 'advancement'],
		[keys.awards, 'awards']
	] as const) {
		const entry = { body: fixture(code, name), lastModified: null, fetchedAt: at };
		await redis.set(`pitstop:cache:${key}`, JSON.stringify(entry), { ex: 8 * 86_400 });
	}
}

function instance(redis: FakeRedis, clock: { now: number }, listing = events) {
	const now = () => clock.now;
	const pending: Promise<unknown>[] = [];
	const cache = createCache({
		store: redisStore(redis),
		onError: () => {},
		now,
		background: (task) => pending.push(task)
	});
	let listed = 0;
	const advancement = createAdvancement({
		cache,
		store: redisStore(redis),
		loadSeasonEvents: async () => {
			listed += 1;
			return { events: listing, fetchedAt: NOW };
		},
		teamNames: async () => new Map([[34672, 'Hive Minds']]),
		now
	});
	return {
		...advancement,
		settle: () => Promise.all(pending.splice(0)),
		listed: () => listed
	};
}

async function commands(redis: FakeRedis, task: () => Promise<unknown>): Promise<string[]> {
	const before = redis.calls.length;
	await task();
	return redis.calls.slice(before);
}

describe('advancement index', () => {
	it('builds from cached event data in one batched read and then reads nothing', async () => {
		const redis = createFakeRedis(() => NOW);
		await seed(redis, 'USMISOQ', NOW - 15 * DAY_MS);
		await seed(redis, 'USMINOQ', NOW - DAY_MS);
		const clock = { now: NOW };
		const first = instance(redis, clock);
		const cold = await commands(redis, () => first.loadAdvancement());
		expect(cold).toEqual(['mget', 'mget', 'set']);
		expect(await commands(redis, () => first.loadAdvancement())).toEqual([]);

		const { index } = await first.loadAdvancement();
		const michigan = index.championships.find((entry) => entry.code === 'USMISECMP')!;
		expect(michigan.teams.slice(0, 2).map((team) => [team.team, team.name, team.event])).toEqual([
			[34672, 'Hive Minds', 'USMISOQ'],
			[5237, null, 'USMISOQ']
		]);
		expect(michigan.teams[0].reasons).toEqual(['Inspire']);
		expect(michigan.teams).toHaveLength(11);
		expect(michigan.feeders.find((feeder) => feeder.code === 'USMIXQ')?.state).toBe('pending');
	});

	it('shares the index so a fresh instance reads one key', async () => {
		const redis = createFakeRedis(() => NOW);
		await seed(redis, 'USMISOQ', NOW - DAY_MS);
		const clock = { now: NOW };
		await instance(redis, clock).loadAdvancement();
		expect(redis.ttl(`pitstop:cache:${ADVANCEMENT_KEY}`)).toBeGreaterThan(30 * 86_400);
		const fresh = instance(redis, clock);
		expect(await commands(redis, () => fresh.loadAdvancement())).toEqual(['mget']);
	});

	it('refreshes in the background after an hour and keeps teams after event data expires', async () => {
		const redis = createFakeRedis(() => clock.now);
		const clock = { now: NOW };
		await seed(redis, 'USMISOQ', NOW - DAY_MS);
		const page = instance(redis, clock);
		await page.loadAdvancement();
		clock.now += 9 * DAY_MS;
		expect(redis.keys().some((key) => key.includes('advancement/USMISOQ'))).toBe(false);
		const stale = await page.loadAdvancement();
		expect(stale.stale).toBe(false);
		await page.settle();
		const fresh = instance(redis, clock);
		const { index } = await fresh.loadAdvancement();
		expect(index.generatedAt).toBe(clock.now);
		const teams = index.championships.find((entry) => entry.code === 'USMISECMP')!.teams;
		expect(teams.map((team) => team.team)).toContain(34672);
	});

	it('stops rereading events that settled weeks ago', async () => {
		const redis = createFakeRedis(() => clock.now);
		const clock = { now: NOW };
		await seed(redis, 'USMISOQ', NOW);
		const page = instance(redis, clock, [events[0], events[3]]);
		await page.loadAdvancement();
		clock.now += 2 * HOUR_MS;
		await page.loadAdvancement();
		const calls = await commands(redis, () => page.settle());
		expect(calls).toEqual(['mget', 'set']);
		expect(page.listed()).toBeGreaterThan(0);
	});
});
