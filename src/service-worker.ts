import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { isCacheableResponse, isDataRequest } from '#lib/pwa/rules.ts';

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
const SHELL = `pitstop-shell-${version}`;
const DATA = 'pitstop-data';
const OFFLINE_HEADER = 'x-pitstop-offline';
const scope = new URL(worker.registration.scope).pathname;
const shellFiles = [...immutable, ...assets].map((file) => `${scope}${file.path}`);
const shell = new Set(shellFiles);

async function install() {
	const cache = await caches.open(SHELL);
	await cache.addAll(shellFiles);
	await worker.skipWaiting();
}

async function activate() {
	for (const key of await caches.keys()) {
		if (key !== SHELL && key !== DATA) await caches.delete(key);
	}
	await worker.clients.claim();
}

async function cacheFirst(request: Request): Promise<Response> {
	const cached = await caches.match(request, { cacheName: SHELL });
	return cached ?? fetch(request);
}

async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(DATA);
	try {
		const response = await fetch(request);
		if (isCacheableResponse(response)) void cache.put(request, response.clone());
		return response;
	} catch (error) {
		const cached = await cache.match(request);
		if (!cached) throw error;
		const headers = new Headers(cached.headers);
		headers.set(OFFLINE_HEADER, '1');
		return new Response(cached.body, {
			status: cached.status,
			statusText: cached.statusText,
			headers
		});
	}
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
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== location.origin) return;
	if (shell.has(url.pathname)) {
		event.respondWith(cacheFirst(request));
	} else if (isDataRequest(url.pathname, scope, request.mode)) {
		event.respondWith(networkFirst(request));
	}
});

worker.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(focusWindow());
});
