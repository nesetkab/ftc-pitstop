import { describe, expect, it } from 'vitest';
import {
	dataCache,
	dataKey,
	isCacheableResponse,
	obsoleteCaches,
	overflow,
	PAGES_CACHE,
	pageAssets,
	pageFits,
	shellCache,
	strategyFor,
	type RouteInput
} from './rules.ts';

const shell = new Set(['/_app/immutable/entry/start.abc.js', '/favicon.svg']);

function route(pathname: string, mode = 'cors', method = 'GET', scope = '/') {
	const input: RouteInput = { method, mode, pathname, scope, shell };
	return strategyFor(input);
}

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

describe('cached pages across deploys', () => {
	const html = `<link rel="modulepreload" href="../_app/immutable/entry/start.abc.js">
		<link href="../_app/immutable/assets/0.css" rel="stylesheet">
		<script>import("https://cdn.test/_app/immutable/x.js")</script>`;

	it('finds the build files a page needs', () => {
		expect(pageAssets(html, 'https://pitstop.test/724/tv')).toEqual([
			'/_app/immutable/entry/start.abc.js',
			'/_app/immutable/assets/0.css'
		]);
	});

	it('keeps a page only while the shell still holds its files', () => {
		const page = 'https://pitstop.test/724/tv';
		const current = new Set(['/_app/immutable/entry/start.abc.js', '/_app/immutable/assets/0.css']);
		expect(pageFits(html, page, current)).toBe(true);
		expect(pageFits(html, page, new Set(['/_app/immutable/entry/start.abc.js']))).toBe(false);
		expect(pageFits('<p>no scripts</p>', page, current)).toBe(false);
	});
});

describe('cache housekeeping', () => {
	it('names caches by build so a deploy replaces them', () => {
		expect(shellCache('1')).not.toBe(shellCache('2'));
		expect(dataCache('1')).not.toBe(dataCache('2'));
	});

	it('removes old pitstop caches and leaves unrelated ones', () => {
		const keys = ['pitstop-shell-1', 'pitstop-shell-2', 'pitstop-data', PAGES_CACHE, 'other'];
		expect(obsoleteCaches(keys, ['pitstop-shell-2', PAGES_CACHE])).toEqual([
			'pitstop-shell-1',
			'pitstop-data'
		]);
	});

	it('drops the oldest entries past the limit', () => {
		expect(overflow([1, 2, 3, 4], 2)).toEqual([1, 2]);
		expect(overflow([1, 2], 5)).toEqual([]);
	});
});
