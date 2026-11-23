import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheControlFor } from '#lib/server/event.ts';
import { CACHE_CONTROL, shortestCache } from '#lib/server/http.ts';

const server = vi.hoisted(() => ({
	loadEventBundle: vi.fn(),
	loadQueueStatus: vi.fn(),
	loadTeamSeason: vi.fn(),
	getAnalysis: vi.fn(),
	loadSeasonRatingsWithin: vi.fn(),
	loadEventAnalysisEntry: vi.fn()
}));

vi.mock('#lib/server/event.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/server/event.ts')>()),
	loadEventBundle: server.loadEventBundle,
	loadQueueStatus: server.loadQueueStatus,
	loadTeamSeason: server.loadTeamSeason
}));

vi.mock('#lib/components/pit/analysis.server.ts', () => ({ getAnalysis: server.getAnalysis }));

vi.mock('#lib/server/analysis.ts', () => ({
	loadSeasonRatingsWithin: server.loadSeasonRatingsWithin,
	loadEventAnalysisEntry: server.loadEventAnalysisEntry
}));

vi.mock('#lib/server/strength.ts', () => ({ loadStrengthWithin: async () => null }));

const { load: pitLoad } = await import('../../src/routes/(bare)/[team=team]/+layout.server.ts');
const { loadBreakdowns } =
	await import('../../src/routes/(app)/events/[code]/breakdowns.server.ts');
const { GET: liteRoute } = await import('../../src/routes/api/events/[code]/lite/+server.ts');
const { load: teamsLoad } =
	await import('../../src/routes/(app)/events/[code]/teams/+page.server.ts');
const { loadRpCounts } = await import('../../src/routes/(app)/events/[code]/rp.server.ts');
const { load: matchLoad } =
	await import('../../src/routes/(app)/events/[code]/matches/[key]/+page.server.ts');
const { fixtureBundle } = await import('../../src/lib/components/event/test-fixtures.ts');

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
			params: { code: 'USAZGIQ' },
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

describe('score breakdowns', () => {
	const result = {
		red: { total: 10, breakdown: { auto: { tips: 1 } } },
		blue: { total: 5, breakdown: { auto: { tips: 0 } } },
		winner: 'red'
	};
	const scored = { ...bundle, matches: [{ key: 'q1', result }, { key: 'q2', result: null }] };

	it('serves pit screens the bundle without breakdowns, cached like the full one', async () => {
		server.loadEventBundle.mockResolvedValue({ ...scored, cacheControl: CACHE_CONTROL.live });
		const response = await liteRoute({ params: { code: 'USAZGIQ' } } as never);
		expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.live);
		const body = await response.json();
		expect(body.matches[0].result.red).toEqual({ total: 10, breakdown: null });
		expect(body).not.toHaveProperty('cacheControl');
	});

	it('gives the results and match pages the breakdowns with the event page cache time', async () => {
		server.loadEventBundle.mockResolvedValue({ ...scored, cacheControl: CACHE_CONTROL.finished });
		const setHeaders = vi.fn();
		const data = await loadBreakdowns({
			params: { code: 'USAZGIQ' },
			parent: async () => ({ cacheControl: CACHE_CONTROL.short }),
			setHeaders
		});
		expect(data.breakdowns).toEqual({ q1: [result.red.breakdown, result.blue.breakdown] });
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': CACHE_CONTROL.short });
	});
});

describe('ranking point counts', () => {
	it('reuses the cached bundle and leaves the cache header to the layout', async () => {
		const montana = fixtureBundle('USMTBUQ-final');
		server.loadEventBundle.mockResolvedValue({ ...montana, cacheControl: CACHE_CONTROL.finished });
		const parent = vi.fn(async () => ({}));
		const data = await loadRpCounts({ params: { code: 'USMTBUQ' }, parent });
		expect(parent).toHaveBeenCalled();
		expect(Object.keys(data.rp ?? {})).toHaveLength(montana.rankings.length);
	});

	it('skips league meets whose rankings include earlier meets', async () => {
		const league = fixtureBundle('USMIWMM8');
		server.loadEventBundle.mockResolvedValue({ ...league, cacheControl: CACHE_CONTROL.finished });
		const data = await loadRpCounts({ params: { code: 'USMIWMM8' }, parent: async () => ({}) });
		expect(data.rp).toBeNull();
	});
});

describe('match page', () => {
	it('sends only the OPR moves for the teams in that match', async () => {
		server.loadEventBundle.mockResolvedValue({ ...bundle, cacheControl: CACHE_CONTROL.finished });
		server.loadEventAnalysisEntry.mockResolvedValue({
			cacheControl: CACHE_CONTROL.finished,
			analysis: {
				ratings: [
					{ team: 1, prior: 20, history: [{ key: 'q3', time: 3, opr: 24 }] },
					{ team: 2, prior: 30, history: [{ key: 'q1', time: 1, opr: 31 }] }
				]
			}
		});
		const data = await matchLoad({
			params: { code: 'USAZGIQ', key: 'Q3' },
			parent: async () => ({ cacheControl: CACHE_CONTROL.short }),
			setHeaders: vi.fn()
		} as never);
		expect(data).toMatchObject({ oprShifts: { 1: { before: 20, after: 24 } } });
	});
});

