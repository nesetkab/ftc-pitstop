import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import {
	acceptPage,
	DATA_TIMEOUT,
	dataCache,
	dataKey,
	fallbackDelay,
	firstAnswer,
	isCacheableResponse,
	isImmutable,
	MAX_DATA_ENTRIES,
	MAX_PAGE_ENTRIES,
	obsoleteCaches,
	OFFLINE_HEADER,
	overflow,
	PAGE_TIMEOUT,
	pageCache,
	shellCache,
	strategyFor
} from '#lib/pwa/rules.ts';

interface ExtendableEvent extends Event {
	waitUntil(promise: Promise<unknown>): void;
}

interface FetchEvent extends ExtendableEvent {
	readonly request: Request;
	respondWith(response: Response | Promise<Response>): void;
}

interface NotificationEvent extends ExtendableEvent {
	readonly notification: Notification;
}

interface WindowClient {
	readonly url: string;
	focus(): Promise<WindowClient>;
}

interface WorkerScope {
	readonly registration: { readonly scope: string };
	readonly clients: {
		claim(): Promise<void>;
		matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<WindowClient[]>;
		openWindow(url: string): Promise<WindowClient | null>;
	};
	skipWaiting(): Promise<void>;
	addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void;
	addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
	addEventListener(type: 'notificationclick', listener: (event: NotificationEvent) => void): void;
}

const worker = globalThis as unknown as WorkerScope;
const SHELL = shellCache(version);
const DATA = dataCache(version);
const PAGES = pageCache(version);
const scope = new URL(worker.registration.scope).pathname;
const shellFiles = [...immutable, ...assets].map((file) => `${scope}${file.path}`);
const shell = new Set(shellFiles);

async function precache(cache: Cache, path: string) {
	const hashed = isImmutable(path);
	const reusable = hashed ? await caches.match(path) : undefined;
	if (reusable) return cache.put(path, reusable);
	const response = await fetch(path, { cache: hashed ? 'default' : 'no-cache' });
	if (!response.ok) throw new Error(`Precache of ${path} returned ${response.status}`);
	await cache.put(path, response);
}

async function install() {
	const cache = await caches.open(SHELL);
	const present = new Set((await cache.keys()).map((request) => new URL(request.url).pathname));
	await Promise.allSettled(
		shellFiles.filter((path) => !present.has(path)).map((path) => precache(cache, path))
	);
	await worker.skipWaiting();
}

async function activate() {
	const stale = obsoleteCaches(await caches.keys(), [SHELL, DATA, PAGES]);
	await Promise.all(stale.map((key) => caches.delete(key)));
	await worker.clients.claim();
}

async function fromShell(request: Request): Promise<Response> {
	const cached = await caches.match(request, { cacheName: SHELL });
	return cached ?? fetch(request);
}

async function trim(cache: Cache, max: number) {
	const keys = await cache.keys();
	await Promise.all(overflow(keys, max).map((key) => cache.delete(key)));
}

interface Store {
	name: string;
	max: number;
	timeout: number;
	accept(response: Response): Promise<Response | null>;
}

const dataStore: Store = {
	name: DATA,
	max: MAX_DATA_ENTRIES,
	timeout: DATA_TIMEOUT,
	accept: async (response) => response
};

const pageStore: Store = {
	name: PAGES,
	max: MAX_PAGE_ENTRIES,
	timeout: PAGE_TIMEOUT,
	accept: (response) => acceptPage(response, version)
};

async function store(target: Store, key: string, response: Response) {
	const accepted = await target.accept(response);
	if (!accepted) return;
	const cache = await caches.open(target.name);
	await cache.delete(key);
	await cache.put(key, accepted);
	await trim(cache, target.max);
}

async function cachedCopy(target: Store, key: string): Promise<Response | null> {
	const cached = await caches.match(key, { cacheName: target.name });
	return cached ? target.accept(cached) : null;
}

function offline(cached: Response): Response {
	const headers = new Headers(cached.headers);
	headers.set(OFFLINE_HEADER, '1');
	return new Response(cached.body, {
		status: cached.status,
		statusText: cached.statusText,
		headers
	});
}

function networkFirst(event: FetchEvent, target: Store, key: string): Promise<Response> {
	const network = fetch(event.request).then((response) => {
		if (isCacheableResponse(response)) {
			event.waitUntil(store(target, key, response.clone()).catch(() => undefined));
		}
		return response;
	});
	event.waitUntil(network.catch(() => undefined));
	const fallback = async () => {
		const cached = await cachedCopy(target, key);
		return cached ? offline(cached) : null;
	};
	return firstAnswer(network, fallback, fallbackDelay(navigator.onLine, target.timeout));
}

async function focusWindow() {
	const windows = await worker.clients.matchAll({ type: 'window', includeUncontrolled: true });
	if (windows[0]) await windows[0].focus();
	else await worker.clients.openWindow(scope);
}

worker.addEventListener('install', (event) => event.waitUntil(install()));

worker.addEventListener('activate', (event) => event.waitUntil(activate()));

worker.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (url.origin !== location.origin) return;
	const strategy = strategyFor({
		method: request.method,
		mode: request.mode,
		pathname: url.pathname,
		scope,
		shell
	});
	if (strategy === 'shell') {
		event.respondWith(fromShell(request));
	} else if (strategy === 'page') {
		event.respondWith(networkFirst(event, pageStore, url.href));
	} else if (strategy === 'data') {
		event.respondWith(networkFirst(event, dataStore, dataKey(request.url)));
	}
});

worker.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(focusWindow());
});
