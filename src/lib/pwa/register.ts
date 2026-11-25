import { CACHE_PAGE, CACHE_PREFIX, isOfflinePage, pageCache } from './rules.ts';

export const WORKER_URL = '/service-worker.js';
export const OFFLINE_KEY = 'ps-offline';
export const RETIRE_DELAY = 15_000;
const USE_PREFIXES = [OFFLINE_KEY, 'ps-ws:', 'ps-cache:', 'ps-pending:', 'ps-tv-'];

interface ActiveWorker {
	postMessage(message: unknown): void;
}

interface Registration {
	unregister(): Promise<boolean>;
}

export interface KeepDeps {
	served: string | null;
	register(): Promise<unknown>;
	ready(): Promise<{ readonly active: ActiveWorker | null }>;
	mark(): void;
}

export interface RetireDeps {
	path: string;
	used(): boolean;
	mark(): void;
	registration(): Promise<Registration | undefined>;
	keys(): Promise<string[]>;
	entries(key: string): Promise<number>;
	remove(key: string): Promise<boolean>;
}

export function withoutHash(url: string): string {
	const parsed = new URL(url);
	parsed.hash = '';
	return parsed.href;
}

export function createKeeper(deps: KeepDeps): (url: string) => Promise<void> {
	let registration: Promise<unknown> | null = null;
	return async (url) => {
		deps.mark();
		registration ??= deps.register().catch((error: unknown) => {
			registration = null;
			throw error;
		});
		await registration;
		const target = withoutHash(url);
		if (target === deps.served) return;
		const { active } = await deps.ready();
		active?.postMessage({ type: CACHE_PAGE, url: target });
	};
}

export function usedOffline(keys: readonly string[]): boolean {
	return keys.some((key) => USE_PREFIXES.some((prefix) => key.startsWith(prefix)));
}

export async function retireWorker(deps: RetireDeps): Promise<boolean> {
	if (isOfflinePage(deps.path) || deps.used()) return false;
	const registration = await deps.registration();
	if (!registration) return false;
	const keys = (await deps.keys()).filter((key) => key.startsWith(CACHE_PREFIX));
	const pages = keys.filter((key) => key.startsWith(pageCache('')));
	const counts = await Promise.all(pages.map((key) => deps.entries(key)));
	if (counts.some((count) => count > 0)) {
		deps.mark();
		return false;
	}
	if (deps.used()) return false;
	void registration.unregister().catch(() => false);
	await Promise.all(keys.map((key) => deps.remove(key)));
	return true;
}

function storageKeys(): string[] {
	try {
		return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) ?? '');
	} catch {
		return [];
	}
}

function markOffline() {
	try {
		localStorage.setItem(OFFLINE_KEY, '1');
	} catch {
		return;
	}
}

function servedUrl(): string | null {
	const [entry] = performance.getEntriesByType?.('navigation') ?? [];
	const navigation = entry as PerformanceNavigationTiming | undefined;
	return navigation && navigation.workerStart > 0 ? withoutHash(navigation.name) : null;
}

let keeper: ((url: string) => Promise<void>) | null = null;

export function keepOffline(url: string): Promise<void> {
	const workers = globalThis.navigator?.serviceWorker;
	if (!workers) return Promise.resolve();
	keeper ??= createKeeper({
		served: servedUrl(),
		register: () => workers.register(WORKER_URL, { type: 'module' }),
		ready: () => workers.ready,
		mark: markOffline
	});
	return keeper(url).catch(() => undefined);
}

export function scheduleRetire(delay = RETIRE_DELAY): () => void {
	const workers = globalThis.navigator?.serviceWorker;
	if (!workers || typeof caches === 'undefined') return () => {};
	const timer = setTimeout(() => {
		void retireWorker({
			path: location.pathname.slice(1),
			used: () => usedOffline(storageKeys()),
			mark: markOffline,
			registration: () => workers.getRegistration(),
			keys: () => caches.keys(),
			entries: async (key) => (await (await caches.open(key)).keys()).length,
			remove: (key) => caches.delete(key)
		}).catch(() => false);
	}, delay);
	return () => clearTimeout(timer);
}
