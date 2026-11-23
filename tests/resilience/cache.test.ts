import { describe, expect, it, vi } from 'vitest';
import { createCache, redisStore, type CacheEntry, type CacheStore } from '#lib/server/cache.ts';
import type { RedisLike } from '#lib/server/redis.ts';
import { ceiling } from '../timing.ts';

const upstash = vi.hoisted(() => ({ configs: [] as Record<string, unknown>[] }));

vi.mock('@upstash/redis', () => ({
	Redis: class {
		constructor(config: Record<string, unknown>) {
			upstash.configs.push(config);
		}
	}
}));

vi.mock('$app/env/private', () => ({
	KV_REST_API_URL: 'https://fake-redis.upstash.io',
	KV_REST_API_TOKEN: 'fake-token-123456',
	UPSTASH_REDIS_REST_URL: undefined,
	UPSTASH_REDIS_REST_TOKEN: undefined
}));

const policy = { ttl: 300, maxStale: 600 };

function brokenRedis(mode: 'throw' | 'hang'): RedisLike & { calls: number } {
	const redis = {
		calls: 0,
		async mget() {
			redis.calls += 1;
			if (mode === 'throw') throw new Error('ECONNREFUSED');
			return new Promise<unknown[]>(() => {});
		},
		async set() {
			redis.calls += 1;
			if (mode === 'throw') throw new Error('ECONNREFUSED');
			return new Promise<unknown>(() => {});
		}
	};
	return redis;
}

function fresh(body: unknown) {
	return vi.fn(async () => ({ status: 'ok' as const, body }));
}

describe('cache when Redis fails', () => {
	it.each(['throw', 'hang'] as const)(
		'falls through to the source when every Redis command %ss',
		async (mode) => {
			const redis = brokenRedis(mode);
			const cache = createCache({
				store: redisStore(redis),
				onError: () => {},
				storeTimeoutMs: 50
			});
			const fetcher = fresh({ ok: true });
			const started = performance.now();
			const value = await cache.get('event:X', policy, fetcher);
			expect(value).toMatchObject({ body: { ok: true }, stale: false });
			expect(fetcher).toHaveBeenCalledTimes(1);
			expect(performance.now() - started).toBeLessThan(ceiling(500));
			expect((await cache.get('event:X', policy, fetcher)).body).toEqual({ ok: true });
			expect(fetcher).toHaveBeenCalledTimes(1);
		}
	);

	it('stops calling Redis for a while after it keeps failing', async () => {
		const redis = brokenRedis('throw');
		const clock = { now: 0 };
		const cache = createCache({
			store: redisStore(redis),
			onError: () => {},
			now: () => clock.now
		});
		for (let i = 0; i < 6; i++) await cache.get(`key:${i}`, policy, fresh(i));
		const calls = redis.calls;
		for (let i = 6; i < 20; i++) await cache.get(`key:${i}`, policy, fresh(i));
		expect(redis.calls).toBe(calls);
		clock.now += 60_000;
		await cache.get('key:late', policy, fresh('late'));
		expect(redis.calls).toBeGreaterThan(calls);
	});

	it('bounds a store that hangs on reads and writes', async () => {
		const store: CacheStore = {
			get: () => new Promise<CacheEntry | null>(() => {}),
			set: () => new Promise<void>(() => {})
		};
		const cache = createCache({ store, onError: () => {}, storeTimeoutMs: 30 });
		const started = performance.now();
		await expect(cache.get('slow', policy, fresh(1))).resolves.toMatchObject({ body: 1 });
		expect(performance.now() - started).toBeLessThan(ceiling(500));
	});

	it('configures the Upstash client with one quick retry and a request timeout', async () => {
		const { getRedis, REDIS_TIMEOUT_MS } = await import('#lib/server/redis.ts');
		getRedis();
		const config = upstash.configs.at(-1)!;
		expect(config.retry).toMatchObject({ retries: 1 });
		expect(typeof config.signal).toBe('function');
		expect((config.signal as () => AbortSignal)()).toBeInstanceOf(AbortSignal);
		expect(REDIS_TIMEOUT_MS).toBeLessThanOrEqual(2000);
	});
});

describe('cache when the source fails', () => {
	it('serves the last good copy marked stale once a refresh has failed', async () => {
		const clock = { now: 0 };
		const cache = createCache({ onError: () => {}, now: () => clock.now, background: () => {} });
		await cache.get('scores', policy, fresh('good'));
		clock.now += (policy.ttl + policy.maxStale + 1) * 1000;
		const failing = vi.fn(async () => {
			throw new Error('FTC API is having trouble');
		});
		await expect(cache.get('scores', policy, failing)).resolves.toMatchObject({
			body: 'good',
			stale: true
		});
	});

	it('returns the old copy instead of waiting on a slow refresh', async () => {
		const clock = { now: 0 };
		const tasks: Promise<unknown>[] = [];
		const cache = createCache({
			onError: () => {},
			now: () => clock.now,
			staleWaitMs: 30,
			background: (task) => tasks.push(task)
		});
		await cache.get('scores', policy, fresh('good'));
		clock.now += (policy.ttl + policy.maxStale + 1) * 1000;
		const refresh = Promise.withResolvers<{ status: 'ok'; body: string }>();
		const slow = vi.fn(() => refresh.promise);
		await expect(cache.get('scores', policy, slow)).resolves.toMatchObject({
			body: 'good',
			stale: true
		});
		refresh.resolve({ status: 'ok', body: 'new' });
		await Promise.all(tasks);
		expect((await cache.get('scores', policy, slow)).body).toBe('new');
	});

	it('does not hit a failing source on every request when nothing is cached', async () => {
		const clock = { now: 0 };
		const cache = createCache({ onError: () => {}, now: () => clock.now });
		const failing = vi.fn(async () => {
			throw new Error('down');
		});
		for (let i = 0; i < 5; i++) await expect(cache.get('x', policy, failing)).rejects.toThrow();
		expect(failing).toHaveBeenCalledTimes(1);
		clock.now += 10_000;
		await expect(cache.get('x', policy, failing)).rejects.toThrow();
		expect(failing).toHaveBeenCalledTimes(2);
	});
});
