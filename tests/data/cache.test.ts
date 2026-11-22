import { describe, expect, it, vi } from 'vitest';
import {
	cache as defaultCache,
	createCache,
	LruMap,
	redisStore,
	type CacheEntry,
	type CacheStore,
	type Fetcher
} from '#lib/server/cache.ts';
import type { RedisLike } from '#lib/server/redis.ts';

const policy = { ttl: 30, maxStale: 300 };

function clock(start = 1_000_000) {
	let time = start;
	return {
		now: () => time,
		advance: (seconds: number) => {
			time += seconds * 1000;
		}
	};
}

function counter(values: unknown[] = []) {
	let calls = 0;
	const fetcher = vi.fn(async () => {
		calls++;
		return {
			status: 'ok' as const,
			body: values[calls - 1] ?? `value ${calls}`,
			lastModified: null
		};
	});
	return fetcher;
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const settle = (cache: { pending: () => number }) =>
	vi.waitFor(() => expect(cache.pending()).toBe(0));

describe('cache ttl and stale-while-revalidate', () => {
	it('serves fresh entries without fetching again', async () => {
		const time = clock();
		const cache = createCache({ now: time.now });
		const fetcher = counter();
		expect((await cache.get('a', policy, fetcher)).body).toBe('value 1');
		time.advance(29);
		const again = await cache.get('a', policy, fetcher);
		expect(again).toMatchObject({ body: 'value 1', stale: false });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('serves the old value after the ttl and refreshes in the background', async () => {
		const time = clock();
		const cache = createCache({ now: time.now });
		const fetcher = counter();
		await cache.get('a', policy, fetcher);
		time.advance(31);
		const stale = await cache.get('a', policy, fetcher);
		expect(stale).toMatchObject({ body: 'value 1', stale: false });
		await settle(cache);
		expect(fetcher).toHaveBeenCalledTimes(2);
		const fresh = await cache.get('a', policy, fetcher);
		expect(fresh).toMatchObject({ body: 'value 2', stale: false, fetchedAt: time.now() });
	});

	it('keeps the function alive until a background refresh is done', async () => {
		const time = clock();
		const background = vi.fn();
		const cache = createCache({ now: time.now, background });
		const fetcher = counter();
		await cache.get('a', policy, fetcher);
		expect(background).not.toHaveBeenCalled();
		time.advance(31);
		await cache.get('a', policy, fetcher);
		expect(background).toHaveBeenCalledTimes(1);
		await background.mock.calls[0][0];
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(cache.pending()).toBe(0);
	});

	it('waits for a new value once the entry is older than the stale window', async () => {
		const time = clock();
		const cache = createCache({ now: time.now });
		const fetcher = counter();
		await cache.get('a', policy, fetcher);
		time.advance(policy.ttl + policy.maxStale + 1);
		expect((await cache.get('a', policy, fetcher)).body).toBe('value 2');
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('passes the previous entry so callers can send If-Modified-Since', async () => {
		const time = clock();
		const cache = createCache({ now: time.now });
		const seen: (CacheEntry<string> | null)[] = [];
		const fetcher: Fetcher<string> = async (previous) => {
			seen.push(previous);
			return previous
				? { status: 'unchanged', lastModified: previous.lastModified }
				: { status: 'ok', body: 'body', lastModified: 'Sun, 15 Nov 2026 00:17:42 GMT' };
		};
		await cache.get('a', policy, fetcher);
		time.advance(400);
		const after = await cache.get('a', policy, fetcher);
		expect(seen[0]).toBeNull();
		expect(seen[1]?.lastModified).toBe('Sun, 15 Nov 2026 00:17:42 GMT');
		expect(after).toMatchObject({ body: 'body', fetchedAt: time.now(), stale: false });
	});
});

describe('cache coalescing', () => {
	it('makes one upstream call for concurrent cold reads', async () => {
		const cache = createCache();
		const gate = deferred<void>();
		const fetcher = vi.fn(async () => {
			await gate.promise;
			return { status: 'ok' as const, body: 'shared' };
		});
		const reads = Array.from({ length: 5 }, () => cache.get('a', policy, fetcher));
		await vi.waitFor(() => expect(cache.pending()).toBe(1));
		gate.resolve();
		const values = await Promise.all(reads);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(values.map((value) => value.body)).toEqual(Array(5).fill('shared'));
	});

	it('makes one background refresh for concurrent stale reads', async () => {
		const time = clock();
		const cache = createCache({ now: time.now });
		const gate = deferred<void>();
		let calls = 0;
		const fetcher = vi.fn(async () => {
			calls++;
			if (calls > 1) await gate.promise;
			return { status: 'ok' as const, body: `value ${calls}` };
		});
		await cache.get('a', policy, fetcher);
		time.advance(60);
		const reads = await Promise.all(
			Array.from({ length: 4 }, () => cache.get('a', policy, fetcher))
		);
		expect(reads.every((read) => read.body === 'value 1')).toBe(true);
		expect(cache.pending()).toBe(1);
		gate.resolve();
		await settle(cache);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('keeps different keys independent', async () => {
		const cache = createCache();
		const fetcher = counter(['one', 'two']);
		const [a, b] = await Promise.all([
			cache.get('a', policy, fetcher),
			cache.get('b', policy, fetcher)
		]);
		expect([a.body, b.body].sort()).toEqual(['one', 'two']);
	});
});

describe('cache failures', () => {
	it('throws when there is nothing cached', async () => {
		const cache = createCache({ onError: () => {} });
		await expect(
			cache.get('a', policy, async () => {
				throw new Error('down');
			})
		).rejects.toThrow('down');
		expect(cache.pending()).toBe(0);
	});

	it('serves stale data with the stale flag when a refresh fails', async () => {
		const time = clock();
		const onError = vi.fn();
		const cache = createCache({ now: time.now, onError });
		await cache.get('a', policy, counter(['good']));
		const failing = vi.fn(async () => {
			throw new Error('down');
		});
		time.advance(60);
		expect(await cache.get('a', policy, failing)).toMatchObject({ body: 'good', stale: false });
		await settle(cache);
		expect(onError).toHaveBeenCalled();
		time.advance(1);
		expect(await cache.get('a', policy, failing)).toMatchObject({ body: 'good', stale: true });
		time.advance(policy.maxStale + 60);
		expect(await cache.get('a', policy, failing)).toMatchObject({ body: 'good', stale: true });
		await settle(cache);
		time.advance(1);
		expect(await cache.get('a', policy, counter(['back']))).toMatchObject({
			body: 'back',
			stale: false
		});
	});
});

describe('cache refresh pacing', () => {
	it('waits a ttl before trying a failed background refresh again', async () => {
		const time = clock();
		const cache = createCache({ now: time.now, onError: () => {} });
		await cache.get('a', policy, counter(['good']));
		const failing = vi.fn(async () => {
			throw new Error('down');
		});
		time.advance(31);
		await cache.get('a', policy, failing);
		await settle(cache);
		expect(failing).toHaveBeenCalledTimes(1);
		for (let i = 0; i < 5; i++) {
			time.advance(5);
			expect(await cache.get('a', policy, failing)).toMatchObject({ body: 'good', stale: true });
			await settle(cache);
		}
		expect(failing).toHaveBeenCalledTimes(1);
		time.advance(6);
		await cache.get('a', policy, failing);
		await settle(cache);
		expect(failing).toHaveBeenCalledTimes(2);
		time.advance(policy.ttl);
		const back = counter(['back']);
		await cache.get('a', policy, back);
		await settle(cache);
		expect(await cache.get('a', policy, back)).toMatchObject({ body: 'back', stale: false });
	});
});

describe('cache stores', () => {
	function fakeRedis() {
		const data = new Map<string, string>();
		const redis: RedisLike & {
			data: Map<string, string>;
			ttl: Map<string, number>;
			calls: string[];
		} = {
			data,
			ttl: new Map(),
			calls: [],
			async mget(...keys) {
				redis.calls.push(`mget ${keys.length}`);
				return keys.map((key) => data.get(key) ?? null);
			},
			async set(key, value, options) {
				redis.calls.push('set');
				data.set(key, value);
				redis.ttl.set(key, options.ex);
				return 'OK';
			}
		};
		return redis;
	}

	it('works without Redis configured', async () => {
		expect(defaultCache.pending()).toBe(0);
		const cache = createCache({ store: null });
		expect((await cache.get('x', policy, counter(['memory']))).body).toBe('memory');
	});

	const shared = { ttl: 300, maxStale: 3600 };

	it('shares entries between instances through Redis', async () => {
		const time = clock();
		const redis = fakeRedis();
		const first = createCache({ now: time.now, store: redisStore(redis) });
		const second = createCache({ now: time.now, store: redisStore(redis) });
		await first.get('event', shared, counter(['from first']));
		expect(redis.ttl.get('pitstop:cache:event')).toBe(shared.ttl + shared.maxStale);
		const fetcher = counter(['from second']);
		expect((await second.get('event', shared, fetcher)).body).toBe('from first');
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('picks up a fresher entry another instance stored before refetching', async () => {
		const time = clock();
		const redis = fakeRedis();
		const first = createCache({ now: time.now, store: redisStore(redis) });
		const second = createCache({ now: time.now, store: redisStore(redis) });
		await first.get('event', shared, counter(['v1']));
		await second.get('event', shared, counter(['unused']));
		time.advance(301);
		await first.get('event', shared, counter(['v2']));
		await settle(first);
		const fetcher = counter(['v3']);
		await second.get('event', shared, fetcher);
		await settle(second);
		expect(fetcher).not.toHaveBeenCalled();
		expect((await second.get('event', shared, fetcher)).body).toBe('v2');
	});

	it('keeps entries that refresh every few seconds out of Redis', async () => {
		const time = clock();
		const redis = fakeRedis();
		const cache = createCache({ now: time.now, store: redisStore(redis) });
		for (let i = 0; i < 10; i++) {
			await cache.get('live', policy, counter([`v${i}`]));
			await settle(cache);
			time.advance(policy.ttl + 1);
		}
		expect(redis.calls).toEqual([]);
	});

	it('reads keys asked for together with one Redis command', async () => {
		const time = clock();
		const redis = fakeRedis();
		const writer = createCache({ now: time.now, store: redisStore(redis) });
		for (const key of ['a', 'b', 'c']) await writer.get(key, shared, counter([key]));
		redis.calls.length = 0;
		const reader = createCache({ now: time.now, store: redisStore(redis) });
		const values = await Promise.all(
			['a', 'b', 'c', 'a'].map((key) => reader.get(key, shared, counter(['unused'])))
		);
		expect(values.map((value) => value.body)).toEqual(['a', 'b', 'c', 'a']);
		expect(redis.calls).toEqual(['mget 3']);
	});

	it('compresses large entries and skips ones that are too big', async () => {
		const redis = fakeRedis();
		const store = redisStore(redis);
		const body = Array.from({ length: 4000 }, (_, i) => ({ team: i, name: `Team ${i}` }));
		await store.set('big', { body, lastModified: null, fetchedAt: 1 }, 60);
		expect(redis.data.get('pitstop:cache:big')?.startsWith('gz:')).toBe(true);
		expect((await store.get('big'))?.body).toEqual(body);
		const random = Array.from({ length: 120_000 }, () => Math.random().toString(36).slice(2));
		await store.set('huge', { body: random, lastModified: null, fetchedAt: 1 }, 60);
		expect(redis.data.has('pitstop:cache:huge')).toBe(false);
	});

	it('keeps working when the store fails', async () => {
		const broken: CacheStore = {
			get: async () => {
				throw new Error('redis down');
			},
			set: async () => {
				throw new Error('redis down');
			}
		};
		const onError = vi.fn();
		const cache = createCache({ store: broken, onError });
		expect((await cache.get('a', shared, counter(['ok']))).body).toBe('ok');
		expect(onError).toHaveBeenCalled();
	});
});

describe('LruMap', () => {
	it('evicts the least recently used entry', () => {
		const lru = new LruMap<number>(2);
		lru.set('a', 1);
		lru.set('b', 2);
		lru.get('a');
		lru.set('c', 3);
		expect(lru.get('b')).toBeUndefined();
		expect(lru.get('a')).toBe(1);
		expect(lru.get('c')).toBe(3);
		expect(lru.size).toBe(2);
	});

	it('bounds the cache size', async () => {
		const cache = createCache({ maxEntries: 3 });
		for (const key of ['a', 'b', 'c', 'd']) await cache.get(key, policy, counter([key]));
		expect(cache.peek('a')).toBeNull();
		expect(cache.peek('d')?.body).toBe('d');
	});
});
