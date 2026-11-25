import { createBreaker, type Breaker } from '#lib/server/breaker.ts';
import { describeError } from '#lib/server/errors.ts';
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

export type PolicyChoice<T> = CachePolicy | ((body: T | null) => CachePolicy);

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

export const SHARED_MIN_TTL = 120;
const WARM_MS = 5_000;
export const STORE_TIMEOUT_MS = 2_000;
export const STALE_WAIT_MS = 2_500;
export const FAILURE_MEMO_MS = 10_000;
const LATE = Symbol('late');

class StoreTimeout extends Error {
	constructor() {
		super('Cache store timed out');
		this.name = 'StoreTimeout';
	}
}

function waitFor<T>(task: Promise<T>, ms: number): Promise<T | typeof LATE> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const late = new Promise<typeof LATE>((resolve) => {
		timer = setTimeout(() => resolve(LATE), ms);
	});
	return Promise.race([task, late]).finally(() => clearTimeout(timer));
}

export async function settleWithin<T>(task: Promise<T>, ms: number): Promise<T | null> {
	const guarded = task.catch(() => null);
	const result = await waitFor(guarded, ms);
	if (result !== LATE) return result;
	keepAlive(guarded);
	return null;
}

async function bounded<T>(task: Promise<T>, ms: number): Promise<T> {
	task.catch(() => undefined);
	const result = await waitFor(task, ms);
	if (result === LATE) throw new StoreTimeout();
	return result;
}

export interface CacheOptions {
	maxEntries?: number;
	store?: CacheStore | null;
	sharedMinTtl?: number;
	now?: () => number;
	onError?: (key: string, error: unknown) => void;
	background?: (task: Promise<unknown>) => void;
	storeTimeoutMs?: number;
	staleWaitMs?: number;
	storeBreaker?: Breaker;
}

type RequestStore = { get?: () => { waitUntil?: (task: Promise<unknown>) => void } | undefined };

const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');

export function keepAlive(task: Promise<unknown>): void {
	const store = (globalThis as unknown as Record<symbol, RequestStore | undefined>)[
		REQUEST_CONTEXT
	];
	store?.get?.()?.waitUntil?.(task.catch(() => undefined));
}

function logError(key: string, error: unknown) {
	console.warn(`cache refresh failed for ${key}: ${describeError(error)}`);
}

export function createCache(options: CacheOptions = {}) {
	const memory = new LruMap<CacheEntry>(options.maxEntries ?? 1500);
	const warming = new LruMap<{ at: number; read: Promise<CacheEntry | null> }>(200);
	const absent = new LruMap<number>(500);
	const inflight = new Map<string, Promise<CacheEntry>>();
	const failures = new LruMap<number>(500);
	const errors = new LruMap<{ at: number; error: unknown }>(500);
	const written = new LruMap<number>(1500);
	const store = options.store ?? null;
	const now = options.now ?? Date.now;
	const onError = options.onError ?? logError;
	const background = options.background ?? keepAlive;
	const sharedMinTtl = options.sharedMinTtl ?? SHARED_MIN_TTL;
	const storeTimeoutMs = options.storeTimeoutMs ?? STORE_TIMEOUT_MS;
	const staleWaitMs = options.staleWaitMs ?? STALE_WAIT_MS;
	const storeBreaker =
		options.storeBreaker ?? createBreaker({ threshold: 3, cooldownMs: 15_000, now });

	function shared(policy: CachePolicy): boolean {
		return store !== null && policy.ttl >= sharedMinTtl;
	}

	async function useStore<T>(key: string, run: (store: CacheStore) => Promise<T>) {
		if (!store || !storeBreaker.allow()) return null;
		try {
			const result = await bounded(run(store), storeTimeoutMs);
			storeBreaker.success();
			return result;
		} catch (error) {
			storeBreaker.failure();
			onError(key, error);
			return null;
		}
	}

	function readStore(key: string): Promise<CacheEntry | null> {
		return useStore(key, (store) => store.get(key));
	}

	async function writeStore(key: string, entry: CacheEntry, policy: CachePolicy) {
		if (!shared(policy)) return;
		const saved = await useStore(key, async (store) => {
			await store.set(key, entry, Math.ceil(policy.ttl + policy.maxStale));
			return true;
		});
		if (saved) written.set(key, entry.fetchedAt);
	}

	function storedRecently(key: string, policy: CachePolicy): boolean {
		const at = written.get(key);
		return at !== undefined && now() - at < (policy.maxStale * 1000) / 2;
	}

	function prefetch(keys: string[]) {
		if (!store) return;
		for (const key of keys) {
			if (memory.get(key) || warming.get(key)) continue;
			warming.set(key, { at: now(), read: readStore(key) });
		}
	}

	function warmRead(key: string): Promise<CacheEntry | null> | null {
		const warm = warming.get(key);
		if (!warm) return null;
		if (now() - warm.at < WARM_MS) return warm.read;
		warming.delete(key);
		return null;
	}

	function age(entry: CacheEntry): number {
		return (now() - entry.fetchedAt) / 1000;
	}

	function refresh(
		key: string,
		choose: (body: unknown) => CachePolicy,
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
					written.set(key, shared.fetchedAt);
					if (age(shared) < choose(shared.body).ttl) return shared;
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
			errors.delete(key);
			const policy = choose(entry.body);
			if (result.status !== 'unchanged' || !previous || !storedRecently(key, policy)) {
				await writeStore(key, entry, policy);
			}
			return entry;
		})();
		const tracked = task
			.catch((error: unknown) => {
				failures.set(key, now());
				errors.set(key, { at: now(), error });
				throw error;
			})
			.finally(() => inflight.delete(key));
		inflight.set(key, tracked);
		return tracked;
	}

	async function get<T>(
		key: string,
		choice: PolicyChoice<T>,
		fetcher: Fetcher<T>
	): Promise<CachedValue<T>> {
		const choose = (body: unknown) =>
			typeof choice === 'function' ? choice(body as T | null) : choice;
		let entry = memory.get(key) ?? null;
		let checkStore = shared(choose(null));
		if (!entry && checkStore) {
			entry = await (warmRead(key) ?? readStore(key));
			checkStore = false;
			if (entry) {
				memory.set(key, entry);
				written.set(key, entry.fetchedAt);
			}
		}
		const run = fetcher as Fetcher<unknown>;
		const policy = choose(entry?.body ?? null);
		if (entry) {
			const seconds = age(entry);
			const failedAt = failures.get(key) ?? 0;
			const failed = failedAt > entry.fetchedAt;
			if (seconds < policy.ttl) return { ...(entry as CacheEntry<T>), stale: false };
			if (seconds < policy.ttl + policy.maxStale) {
				if (!failed || now() - failedAt >= policy.ttl * 1000) {
					background(
						refresh(key, choose, run, checkStore).catch((error: unknown) => onError(key, error))
					);
				}
				return { ...(entry as CacheEntry<T>), stale: failed };
			}
		}
		const recent = entry ? undefined : errors.get(key);
		if (recent && now() - recent.at < Math.min(FAILURE_MEMO_MS, policy.ttl * 1000)) {
			throw recent.error;
		}
		const running = refresh(key, choose, run, checkStore);
		if (!entry) return { ...((await running) as CacheEntry<T>), stale: false };
		try {
			const fresh = await waitFor(running, staleWaitMs);
			if (fresh !== LATE) return { ...(fresh as CacheEntry<T>), stale: false };
			background(running.catch((error: unknown) => onError(key, error)));
		} catch {
			return { ...(entry as CacheEntry<T>), stale: true };
		}
		return { ...(entry as CacheEntry<T>), stale: true };
	}

	async function lookup(keys: string[], maxAgeMs: number): Promise<Map<string, CacheEntry>> {
		const found = new Map<string, CacheEntry>();
		const missing: string[] = [];
		for (const key of new Set(keys)) {
			const entry = memory.get(key);
			const missedAt = absent.get(key);
			if (entry && now() - entry.fetchedAt < maxAgeMs) found.set(key, entry);
			else if (!entry && missedAt !== undefined && now() - missedAt < maxAgeMs) continue;
			else missing.push(key);
		}
		const loaded = await Promise.all(missing.map((key) => readStore(key)));
		missing.forEach((key, index) => {
			const kept = memory.get(key);
			const shared = loaded[index];
			const best = shared && (!kept || shared.fetchedAt > kept.fetchedAt) ? shared : kept;
			if (!best) {
				if (store) absent.set(key, now());
				return;
			}
			absent.delete(key);
			if (best === shared) {
				memory.set(key, shared);
				written.set(key, shared.fetchedAt);
			}
			found.set(key, best);
		});
		return found;
	}

	return {
		get,
		prefetch,
		lookup,
		peek: (key: string) => memory.get(key) ?? null,
		delete: (key: string) => memory.delete(key),
		clear: () => {
			memory.clear();
			warming.clear();
			absent.clear();
			failures.clear();
			errors.clear();
			written.clear();
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

interface PendingRead {
	key: string;
	resolve: (raw: unknown) => void;
	reject: (error: unknown) => void;
}

export function redisStore(redis: RedisLike, prefix = 'pitstop:cache:'): CacheStore {
	let queue: PendingRead[] = [];

	async function flush() {
		const batch = queue;
		queue = [];
		const keys = [...new Set(batch.map((read) => read.key))];
		try {
			const values = await redis.mget(...keys);
			const found = new Map(keys.map((key, index) => [key, values[index]]));
			for (const read of batch) read.resolve(found.get(read.key));
		} catch (error) {
			for (const read of batch) read.reject(error);
		}
	}

	function read(key: string): Promise<unknown> {
		return new Promise((resolve, reject) => {
			if (queue.length === 0) setTimeout(() => void flush(), 0);
			queue.push({ key, resolve, reject });
		});
	}

	return {
		async get(key) {
			const raw = await read(prefix + key);
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
