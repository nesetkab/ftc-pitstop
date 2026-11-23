import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import {
	DATA_TIMEOUT,
	dataCache,
	dataKey,
	isCacheableResponse,
	isImmutable,
	MAX_DATA_ENTRIES,
	MAX_PAGE_ENTRIES,
	obsoleteCaches,
	OFFLINE_HEADER,
	overflow,
	PAGE_TIMEOUT,
	PAGES_CACHE,
	pageFits,
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
	await Promise.all(
		shellFiles.filter((path) => !present.has(path)).map((path) => precache(cache, path))
	);
	await worker.skipWaiting();
}

async function prunePages() {
	const cache = await caches.open(PAGES_CACHE);
	for (const request of await cache.keys()) {
		const response = await cache.match(request);
		const html = response ? await response.text() : '';
		if (!pageFits(html, request.url, shell)) await cache.delete(request);
	}
}

async function activate() {
	await prunePages().catch(() => caches.delete(PAGES_CACHE));
	const stale = obsoleteCaches(await caches.keys(), [SHELL, DATA, PAGES_CACHE]);
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

async function store(cacheName: string, key: string, response: Response, max: number) {
	const cache = await caches.open(cacheName);
	await cache.delete(key);
	await cache.put(key, response);
	await trim(cache, max);
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

function networkFirst(
	event: FetchEvent,
	cacheName: string,
	key: string,
	max: number,
	timeout: number
): Promise<Response> {
	const network = fetch(event.request).then((response) => {
		if (isCacheableResponse(response)) {
			event.waitUntil(store(cacheName, key, response.clone(), max).catch(() => undefined));
		}
		return response;
	});
	event.waitUntil(network.catch(() => undefined));
	return new Promise<Response>((resolve, reject) => {
		let settled = false;
		const fallback = async (error: unknown) => {
			const cached = await caches.match(key, { cacheName });
			if (settled) return;
			if (cached) {
				settled = true;
				resolve(offline(cached));
			} else if (error !== null) {
				settled = true;
				reject(error);
			}
		};
		const timer = setTimeout(() => void fallback(null), timeout);
		network.then(
			(response) => {
				clearTimeout(timer);
				if (settled) return;
				settled = true;
				resolve(response);
			},
			(error: unknown) => {
				clearTimeout(timer);
				void fallback(error);
			}
		);
	});
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
		event.respondWith(networkFirst(event, PAGES_CACHE, url.href, MAX_PAGE_ENTRIES, PAGE_TIMEOUT));
	} else if (strategy === 'data') {
		const key = dataKey(request.url);
		event.respondWith(networkFirst(event, DATA, key, MAX_DATA_ENTRIES, DATA_TIMEOUT));
	}
});

worker.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(focusWindow());
});
