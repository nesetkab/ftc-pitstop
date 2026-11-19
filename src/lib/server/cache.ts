import { getRedis, type RedisLike } from '#lib/server/redis.ts';

export interface CacheEntry<T = unknown> {
	body: T;
	lastModified: string | null;
	fetchedAt: number;
}

export interface CachedValue<T> extends CacheEntry<T> {
	stale: boolean;
}

export type FetchResult<T> =
	| { status: 'ok'; body: T; lastModified?: string | null }
	| { status: 'unchanged'; lastModified?: string | null };

export type Fetcher<T> = (previous: CacheEntry<T> | null) => Promise<FetchResult<T>>;

export interface CachePolicy {
	ttl: number;
	maxStale: number;
}

export interface CacheStore {
	get(key: string): Promise<CacheEntry | null>;
	set(key: string, entry: CacheEntry, ttlSeconds: number): Promise<void>;
}

export class LruMap<V> {
	readonly #max: number;
	readonly #map = new Map<string, V>();

	constructor(max: number) {
		this.#max = max;
	}

	get size(): number {
		return this.#map.size;
	}

	get(key: string): V | undefined {
		const value = this.#map.get(key);
		if (value !== undefined) {
			this.#map.delete(key);
			this.#map.set(key, value);
		}
		return value;
	}

	set(key: string, value: V): void {
		this.#map.delete(key);
		this.#map.set(key, value);
		for (const oldest of this.#map.keys()) {
			if (this.#map.size <= this.#max) break;
			this.#map.delete(oldest);
		}
	}

	delete(key: string): void {
		this.#map.delete(key);
	}

	clear(): void {
		this.#map.clear();
	}
}

export interface CacheOptions {
	maxEntries?: number;
	store?: CacheStore | null;
	now?: () => number;
	onError?: (key: string, error: unknown) => void;
}

function logError(key: string, error: unknown) {
	const message = error instanceof Error ? error.message : 'unknown error';
	console.warn(`cache refresh failed for ${key}: ${message}`);
}

export function createCache(options: CacheOptions = {}) {
	const memory = new LruMap<CacheEntry>(options.maxEntries ?? 400);
	const inflight = new Map<string, Promise<CacheEntry>>();
	const failures = new Map<string, number>();
	const store = options.store ?? null;
	const now = options.now ?? Date.now;
	const onError = options.onError ?? logError;

	async function readStore(key: string): Promise<CacheEntry | null> {
		if (!store) return null;
		try {
			return await store.get(key);
		} catch (error) {
			onError(key, error);
			return null;
		}
	}

	async function writeStore(key: string, entry: CacheEntry, policy: CachePolicy) {
		if (!store) return;
		try {
			await store.set(key, entry, Math.ceil(policy.ttl + policy.maxStale));
		} catch (error) {
			onError(key, error);
		}
	}

	function age(entry: CacheEntry): number {
		return (now() - entry.fetchedAt) / 1000;
	}

	function refresh(
		key: string,
		policy: CachePolicy,
		fetcher: Fetcher<unknown>,
		checkStore: boolean
	): Promise<CacheEntry> {
		const running = inflight.get(key);
		if (running) return running;
		const task = (async () => {
			let previous = memory.get(key) ?? null;
			if (checkStore) {
				const shared = await readStore(key);
				if (shared && (!previous || shared.fetchedAt > previous.fetchedAt)) {
					memory.set(key, shared);
					if (age(shared) < policy.ttl) return shared;
					previous = shared;
				}
			}
			const result = await fetcher(previous);
			const entry: CacheEntry =
				result.status === 'unchanged' && previous
					? {
							body: previous.body,
							lastModified: result.lastModified ?? previous.lastModified,
							fetchedAt: now()
						}
					: {
							body: result.status === 'ok' ? result.body : null,
							lastModified: result.lastModified ?? null,
							fetchedAt: now()
						};
			memory.set(key, entry);
			failures.delete(key);
			await writeStore(key, entry, policy);
			return entry;
		})();
		const tracked = task
			.catch((error: unknown) => {
				failures.set(key, now());
				throw error;
			})
			.finally(() => inflight.delete(key));
		inflight.set(key, tracked);
		return tracked;
	}

	async function get<T>(
		key: string,
		policy: CachePolicy,
		fetcher: Fetcher<T>
	): Promise<CachedValue<T>> {
		let entry = memory.get(key) ?? null;
		let checkStore = true;
		if (!entry) {
			entry = await readStore(key);
			checkStore = false;
			if (entry) memory.set(key, entry);
		}
		const run = fetcher as Fetcher<unknown>;
		if (entry) {
			const seconds = age(entry);
			const failed = (failures.get(key) ?? 0) > entry.fetchedAt;
			if (seconds < policy.ttl) return { ...(entry as CacheEntry<T>), stale: false };
			if (seconds < policy.ttl + policy.maxStale) {
				refresh(key, policy, run, checkStore).catch((error: unknown) => onError(key, error));
				return { ...(entry as CacheEntry<T>), stale: failed };
			}
		}
		try {
			const fresh = await refresh(key, policy, run, checkStore);
			return { ...(fresh as CacheEntry<T>), stale: false };
		} catch (error) {
			if (entry) return { ...(entry as CacheEntry<T>), stale: true };
			throw error;
		}
	}

	return {
		get,
		peek: (key: string) => memory.get(key) ?? null,
		delete: (key: string) => memory.delete(key),
		clear: () => {
			memory.clear();
			failures.clear();
		},
		pending: () => inflight.size
	};
}

export type Cache = ReturnType<typeof createCache>;

const COMPRESS_OVER = 32 * 1024;
const MAX_STORED = 900 * 1024;

async function gzip(text: string): Promise<string> {
	const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
	return Buffer.from(await new Response(stream).arrayBuffer()).toString('base64');
}

async function gunzip(base64: string): Promise<string> {
	const bytes = Buffer.from(base64, 'base64');
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
	return new Response(stream).text();
}

export function redisStore(redis: RedisLike, prefix = 'pitstop:cache:'): CacheStore {
	return {
		async get(key) {
			const raw = await redis.get(prefix + key);
			if (typeof raw !== 'string') return null;
			const json = raw.startsWith('gz:') ? await gunzip(raw.slice(3)) : raw;
			return JSON.parse(json) as CacheEntry;
		},
		async set(key, entry, ttlSeconds) {
			const json = JSON.stringify(entry);
			const value = json.length > COMPRESS_OVER ? `gz:${await gzip(json)}` : json;
			if (value.length > MAX_STORED) return;
			await redis.set(prefix + key, value, { ex: Math.max(1, ttlSeconds) });
		}
	};
}

function defaultStore(): CacheStore | null {
	const redis = getRedis();
	return redis ? redisStore(redis) : null;
}

export const cache = createCache({ store: defaultStore() });
