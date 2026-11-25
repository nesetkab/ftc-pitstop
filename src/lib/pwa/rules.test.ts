import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	acceptPage,
	CACHE_PAGE,
	dataCache,
	dataKey,
	fallbackDelay,
	firstAnswer,
	isCacheableResponse,
	isPageFrom,
	obsoleteCaches,
	overflow,
	PAGE_TIMEOUT,
	pageCache,
	pageToKeep,
	pageVersion,
	shellCache,
	strategyFor,
	type RouteInput
} from './rules.ts';

afterEach(() => vi.useRealTimers());

const shell = new Set(['/_app/immutable/entry/start.abc.js', '/favicon.svg']);

function route(pathname: string, mode = 'cors', method = 'GET', scope = '/') {
	const input: RouteInput = { method, mode, pathname, scope, shell };
	return strategyFor(input);
}

describe('pageToKeep', () => {
	const keep = (url: unknown, type: unknown = CACHE_PAGE, scope = '/') =>
		pageToKeep({ type, url }, 'https://pit.test', scope);

	it('accepts pit and workspace pages on this site', () => {
		expect(keep('https://pit.test/724')).toBe('https://pit.test/724');
		expect(keep('https://pit.test/724/tv?replay=1#q')).toBe('https://pit.test/724/tv?replay=1');
		expect(keep('https://pit.test/w/ABC234/board')).toBe('https://pit.test/w/ABC234/board');
		expect(keep('https://pit.test/pit/724', CACHE_PAGE, '/pit/')).toBe('https://pit.test/pit/724');
	});

	it('refuses other pages, other sites and odd messages', () => {
		expect(keep('https://pit.test/events/USMTBUQ')).toBeNull();
		expect(keep('https://pit.test/w/share/picklist')).toBeNull();
		expect(keep('https://other.test/724')).toBeNull();
		expect(keep('/724')).toBeNull();
		expect(keep(724)).toBeNull();
		expect(keep('https://pit.test/724', 'skip-waiting')).toBeNull();
		expect(pageToKeep(null, 'https://pit.test', '/')).toBeNull();
		expect(pageToKeep('cache-page', 'https://pit.test', '/')).toBeNull();
	});
});

describe('strategyFor', () => {
	it('serves build files and static assets from the shell', () => {
		expect(route('/_app/immutable/entry/start.abc.js', 'no-cors')).toBe('shell');
		expect(route('/favicon.svg', 'no-cors')).toBe('shell');
	});

	it('keeps pit screens and workspaces available offline', () => {
		for (const path of ['/724', '/724/', '/724/tv', '/12345/tv']) {
			expect(route(path, 'navigate')).toBe('page');
		}
		for (const path of ['/w', '/w/ABC234', '/w/ABC234/picklist', '/w/ABC234/board']) {
			expect(route(path, 'navigate')).toBe('page');
		}
	});

	it('caches the pit data the screens poll', () => {
		expect(route('/api/events/USAZGIQ/lite')).toBe('data');
		expect(route('/api/events/USAZGIQ/analysis')).toBe('data');
		expect(route('/724/__data.json', 'same-origin')).toBe('data');
		expect(route('/724/tv/__data.json', 'same-origin')).toBe('data');
	});

	it('honors a non-root scope', () => {
		expect(route('/pit/724/tv', 'navigate', 'GET', '/pit/')).toBe('page');
		expect(route('/pit/api/events/X1/lite', 'cors', 'GET', '/pit/')).toBe('data');
	});

	it('leaves normal pages to the network so deploys show up at once', () => {
		for (const path of ['/', '/events/USAZGIQ', '/teams/724', '/leaderboards', '/0', '/123456']) {
			expect(route(path, 'navigate')).toBeNull();
		}
		expect(route('/w/share/picklist', 'navigate')).toBeNull();
		expect(route('/724/manifest.webmanifest', 'navigate')).toBeNull();
	});

	it('never touches workspace traffic', () => {
		for (const mode of ['cors', 'navigate', 'same-origin']) {
			expect(route('/api/workspace', mode)).toBeNull();
			expect(route('/api/workspace/ABC234', mode)).toBeNull();
			expect(route('/api/workspace/ABC234/picklist', mode)).toBeNull();
		}
	});

	it('skips other api calls, remote functions and non-GET requests', () => {
		expect(route('/api/events/USAZGIQ')).toBeNull();
		expect(route('/api/nexus/USAZGIQ')).toBeNull();
		expect(route('/api/teams/724')).toBeNull();
		expect(route('/_app/remote/abc/pitAnalysis')).toBeNull();
		expect(route('/api/events/USAZGIQ/lite', 'cors', 'POST')).toBeNull();
		expect(route('/724', 'navigate', 'POST')).toBeNull();
		expect(route('/favicon.svg', 'no-cors', 'HEAD')).toBeNull();
	});

	it('always sends build checks, remote calls and the worker itself to the network', () => {
		const everything = new Set([
			'/_app/version.json',
			'/_app/remote/abc/pitAnalysis',
			'/service-worker.js'
		]);
		for (const pathname of everything) {
			for (const mode of ['cors', 'same-origin', 'no-cors', 'navigate']) {
				expect(
					strategyFor({ method: 'GET', mode, pathname, scope: '/', shell: everything })
				).toBeNull();
			}
		}
		expect(route('/pit/_app/version.json', 'cors', 'GET', '/pit/')).toBeNull();
	});
});

describe('dataKey', () => {
	it('keeps one entry per endpoint whatever the query', () => {
		expect(dataKey('https://pitstop.test/api/events/X1/analysis?v=abc')).toBe(
			'https://pitstop.test/api/events/X1/analysis'
		);
		expect(dataKey('https://pitstop.test/724/__data.json?x-sveltekit-invalidated=01')).toBe(
			'https://pitstop.test/724/__data.json'
		);
	});
});

describe('isCacheableResponse', () => {
	const make = (status: number, headers: Record<string, string> = {}, redirected = false) => ({
		status,
		headers: new Headers(headers),
		redirected
	});

	it('stores plain successful answers', () => {
		expect(isCacheableResponse(make(200))).toBe(true);
		expect(isCacheableResponse(make(200, { 'cache-control': 'public, s-maxage=30' }))).toBe(true);
	});

	it.each(['no-store', 'private', 'private, max-age=60', 'public, no-store', 'NO-STORE'])(
		'does not store answers marked %j',
		(control) => {
			expect(isCacheableResponse(make(200, { 'cache-control': control }))).toBe(false);
		}
	);

	it('does not store errors, redirects, partial answers or answers that set cookies', () => {
		expect(isCacheableResponse(make(404))).toBe(false);
		expect(isCacheableResponse(make(206))).toBe(false);
		expect(isCacheableResponse(make(503))).toBe(false);
		expect(isCacheableResponse(make(0))).toBe(false);
		expect(isCacheableResponse(make(200, {}, true))).toBe(false);
		expect(isCacheableResponse(make(200, { 'set-cookie': 'a=b' }))).toBe(false);
	});
});

function page(version: string) {
	return `<!doctype html><script type="application/ld+json">{"version":"x"}</script>
		<script>
			{
				__sveltekit_abc123 = {
					base: new URL("..", location).pathname.slice(0, -1),
					version: "${version}"
				};
				const element = document.currentScript.parentElement;
			}
		</script>`;
}

function htmlResponse(version: string) {
	return new Response(page(version), {
		status: 200,
		headers: { 'content-type': 'text/html', 'cache-control': 'public' }
	});
}

describe('cached pages across deploys', () => {
	it('reads which build rendered a page', () => {
		expect(pageVersion(page('1795434902727'))).toBe('1795434902727');
		expect(pageVersion('<p>no app</p>')).toBeNull();
		expect(isPageFrom(page('1'), '1')).toBe(true);
		expect(isPageFrom(page('1'), '2')).toBe(false);
		expect(isPageFrom('<p>no app</p>', '2')).toBe(false);
	});

	it('keeps only pages from the running build', async () => {
		expect(await acceptPage(htmlResponse('1'), '2')).toBeNull();
		const kept = await acceptPage(htmlResponse('2'), '2');
		expect(kept?.status).toBe(200);
		expect(kept?.headers.get('content-type')).toBe('text/html');
		expect(await kept?.text()).toBe(page('2'));
	});

	it('stores pages per build so a deploy starts clean', () => {
		expect(pageCache('1')).not.toBe(pageCache('2'));
		expect(
			obsoleteCaches(['pitstop-pages', pageCache('1'), pageCache('2')], [pageCache('2')])
		).toEqual(['pitstop-pages', pageCache('1')]);
	});
});

describe('network first answers', () => {
	const later = <T>(value: T, ms: number) =>
		new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

	it('waits for a slow network instead of serving a page from an older build', async () => {
		vi.useFakeTimers();
		const fresh = htmlResponse('2');
		const fallback = async () => acceptPage(htmlResponse('1'), '2');
		const answer = firstAnswer(later(fresh, PAGE_TIMEOUT * 3), fallback, PAGE_TIMEOUT);
		await vi.advanceTimersByTimeAsync(PAGE_TIMEOUT * 3);
		expect(await answer).toBe(fresh);
	});

	it('serves the same build from cache when the network is slow', async () => {
		vi.useFakeTimers();
		const fallback = async () => acceptPage(htmlResponse('2'), '2');
		const answer = firstAnswer(later(htmlResponse('2'), PAGE_TIMEOUT * 3), fallback, PAGE_TIMEOUT);
		await vi.advanceTimersByTimeAsync(PAGE_TIMEOUT);
		expect(pageVersion(await (await answer).text())).toBe('2');
	});

	it('answers from cache at once when offline', async () => {
		vi.useFakeTimers();
		const cached = new Response('cached');
		const never = new Promise<Response>(() => undefined);
		const answer = firstAnswer(never, async () => cached, fallbackDelay(false, PAGE_TIMEOUT));
		await vi.advanceTimersByTimeAsync(0);
		expect(await answer).toBe(cached);
		expect(fallbackDelay(true, PAGE_TIMEOUT)).toBe(PAGE_TIMEOUT);
	});

	it('falls back when the network fails and passes the error on with nothing cached', async () => {
		const cached = new Response('cached');
		const failure = new TypeError('Failed to fetch');
		expect(await firstAnswer(Promise.reject(failure), async () => cached, PAGE_TIMEOUT)).toBe(
			cached
		);
		await expect(firstAnswer(Promise.reject(failure), async () => null, PAGE_TIMEOUT)).rejects.toBe(
			failure
		);
	});

	it('prefers the network whenever it answers first', async () => {
		const fresh = new Response('fresh');
		const fallback = vi.fn(async () => new Response('cached'));
		expect(await firstAnswer(Promise.resolve(fresh), fallback, PAGE_TIMEOUT)).toBe(fresh);
		expect(fallback).not.toHaveBeenCalled();
	});
});

describe('cache housekeeping', () => {
	it('names caches by build so a deploy replaces them', () => {
		expect(shellCache('1')).not.toBe(shellCache('2'));
		expect(dataCache('1')).not.toBe(dataCache('2'));
	});

	it('removes old pitstop caches and leaves unrelated ones', () => {
		const keys = ['pitstop-shell-1', 'pitstop-shell-2', 'pitstop-data', pageCache('2'), 'other'];
		expect(obsoleteCaches(keys, ['pitstop-shell-2', pageCache('2')])).toEqual([
			'pitstop-shell-1',
			'pitstop-data'
		]);
	});

	it('drops the oldest entries past the limit', () => {
		expect(overflow([1, 2, 3, 4], 2)).toEqual([1, 2]);
		expect(overflow([1, 2], 5)).toEqual([]);
	});
});
