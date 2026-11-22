import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheControlFor } from '#lib/server/event.ts';
import { CACHE_CONTROL, shortestCache } from '#lib/server/http.ts';

const server = vi.hoisted(() => ({
	loadEventBundle: vi.fn(),
	loadQueueStatus: vi.fn(),
	loadTeamSeason: vi.fn(),
	getAnalysis: vi.fn(),
	loadSeasonRatingsWithin: vi.fn()
}));

vi.mock('#lib/server/event.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/server/event.ts')>()),
	loadEventBundle: server.loadEventBundle,
	loadQueueStatus: server.loadQueueStatus,
	loadTeamSeason: server.loadTeamSeason
}));

vi.mock('#lib/components/pit/analysis.server.ts', () => ({ getAnalysis: server.getAnalysis }));

vi.mock('#lib/server/analysis.ts', () => ({
	loadSeasonRatingsWithin: server.loadSeasonRatingsWithin
}));

const { load: pitLoad } = await import('../../src/routes/(bare)/[team=team]/+layout.server.ts');
const { load: teamsLoad } =
	await import('../../src/routes/(app)/events/[code]/teams/+page.server.ts');

const bundle = {
	event: { code: 'USAZGIQ', start: '2026-11-14', end: '2026-11-14', timezone: 'America/Phoenix' },
	teams: [{ number: 2844, name: 'Robots' }],
	matches: [],
	rankings: [],
	alliances: [],
	awards: [],
	advancement: null,
	phase: 'quals',
	fetchedAt: 1,
	stale: false,
	source: 'ftc'
};

describe('event cache tiers', () => {
	it('keeps live events briefly, quiet days a few minutes and finished events for a day', () => {
		expect(cacheControlFor('live', 'quals')).toBe(CACHE_CONTROL.live);
		expect(cacheControlFor('live', 'playoffs')).toBe(CACHE_CONTROL.live);
		expect(cacheControlFor('live', 'done')).toBe(CACHE_CONTROL.short);
		expect(cacheControlFor('upcoming', 'upcoming')).toBe(CACHE_CONTROL.short);
		expect(cacheControlFor('finished', 'done')).toBe(CACHE_CONTROL.finished);
		expect(CACHE_CONTROL.finished).toContain('stale-while-revalidate');
	});

	it('does not keep a finished event for a day when its data could not be refreshed', () => {
		expect(cacheControlFor('finished', 'done', true)).toBe(CACHE_CONTROL.short);
	});

	it('picks the header with the shortest CDN lifetime', () => {
		expect(shortestCache(CACHE_CONTROL.finished, CACHE_CONTROL.live)).toBe(CACHE_CONTROL.live);
		expect(shortestCache(CACHE_CONTROL.short, CACHE_CONTROL.finished)).toBe(CACHE_CONTROL.short);
		expect(shortestCache(CACHE_CONTROL.live, CACHE_CONTROL.none)).toBe(CACHE_CONTROL.none);
		expect(shortestCache(CACHE_CONTROL.ratings)).toBe(CACHE_CONTROL.ratings);
	});
});

describe('pit display caching', () => {
	const setHeaders = vi.fn();

	function run(search = '?event=USAZGIQ') {
		return pitLoad({
			params: { team: 2844 },
			url: new URL(`http://localhost/2844${search}`),
			setHeaders
		} as never) as Promise<Record<string, unknown>>;
	}

	beforeEach(() => {
		setHeaders.mockReset();
		server.loadQueueStatus.mockReset().mockResolvedValue(null);
		server.getAnalysis.mockReset().mockResolvedValue({ code: 'USAZGIQ' });
	});

	it('lets the CDN share a live pit page for the same short time as the event data', async () => {
		server.loadEventBundle.mockResolvedValue({ ...bundle, cacheControl: CACHE_CONTROL.live });
		const data = await run();
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': CACHE_CONTROL.live });
		expect(data.bundle).not.toHaveProperty('cacheControl');
	});

	it('caps finished events at a few minutes so a pit screen never sits on old data for a day', async () => {
		server.loadEventBundle.mockResolvedValue({ ...bundle, cacheControl: CACHE_CONTROL.finished });
		await run();
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': CACHE_CONTROL.short });
	});

	it('keeps the page briefly when the analysis or the event data is missing', async () => {
		server.loadEventBundle.mockResolvedValue({ ...bundle, cacheControl: CACHE_CONTROL.finished });
		server.getAnalysis.mockResolvedValue(null);
		await run();
		expect(setHeaders).toHaveBeenLastCalledWith({ 'cache-control': CACHE_CONTROL.live });
		server.loadEventBundle.mockRejectedValue(new Error('down'));
		await run();
		expect(setHeaders).toHaveBeenLastCalledWith({ 'cache-control': CACHE_CONTROL.live });
	});
});

describe('event teams tab caching', () => {
	const setHeaders = vi.fn();

	function run(cacheControl: string) {
		return teamsLoad({
			parent: async () => ({ bundle, cacheControl }),
			setHeaders
		} as never);
	}

	beforeEach(() => setHeaders.mockReset());

	it('follows season ratings, which change hourly, for finished events', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue({ teams: [{ team: 2844, opr: 50, rank: 3 }] });
		await run(CACHE_CONTROL.finished);
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': CACHE_CONTROL.ratings });
	});

	it('stays brief when the ratings are not ready yet or the event is live', async () => {
		server.loadSeasonRatingsWithin.mockResolvedValue(null);
		await run(CACHE_CONTROL.finished);
		expect(setHeaders).toHaveBeenLastCalledWith({ 'cache-control': CACHE_CONTROL.live });
		server.loadSeasonRatingsWithin.mockResolvedValue({ teams: [{ team: 2844, opr: 50, rank: 3 }] });
		await run(CACHE_CONTROL.live);
		expect(setHeaders).toHaveBeenLastCalledWith({ 'cache-control': CACHE_CONTROL.live });
	});
});
