import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { badgePath } from '#lib/badge/links.ts';
import { insightQuery, parseInsightFilters } from '#lib/components/event/insights.ts';
import { parseRankingChoice, rankingQuery } from '#lib/components/event/ranking-columns.ts';
import { teamListQuery } from '#lib/components/home/followed.ts';
import { parseFilters, queryString } from '#lib/components/leaderboard/leaderboard.ts';
import { parseRecordFilters, recordQuery } from '#lib/components/records/records.ts';
import { isCanonical, parseSides } from '#lib/components/simulate/simulate.ts';
import {
	canonicalRedirect,
	ENDPOINT_QUERY,
	strayQueryRedirect,
	withoutStrayQuery
} from '#lib/server/canonical.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';

vi.mock('$app/env/private', () => ({
	FTC_USERNAME: 'tester',
	FTC_API_KEY: 'not-a-real-key',
	NEXUS_API_KEY: undefined,
	KV_REST_API_URL: undefined,
	KV_REST_API_TOKEN: undefined,
	UPSTASH_REDIS_REST_URL: undefined,
	UPSTASH_REDIS_REST_TOKEN: undefined
}));

const { handle } = await import('../../src/hooks.server.ts');
const { GET: badgeRoute } = await import('../../src/routes/badge/[number].svg/+server.ts');
const { GET: cardRoute } = await import('../../src/routes/badge/[number]/card.svg/+server.ts');
const { GET: followingRoute } = await import('../../src/routes/api/following/+server.ts');
const { GET: recordsCsv } = await import('../../src/routes/records.csv/+server.ts');
const { GET: leaderboardCsv } = await import('../../src/routes/(app)/leaderboards.csv/+server.ts');
const { GET: insightsCsv } =
	await import('../../src/routes/(app)/events/[code]/insights.csv/+server.ts');
const { GET: rankingsCsv } =
	await import('../../src/routes/(app)/events/[code]/rankings.csv/+server.ts');

const { load: compareLoad } = await import('../../src/routes/(app)/compare/+page.server.ts');
const { load: simulateLoad } = await import('../../src/routes/(app)/simulate/+page.server.ts');

const SITE = 'https://www.ftcpitstop.com';
const root = fileURLToPath(new URL('../../src/routes', import.meta.url));

type Handler = (event: never) => Response | Promise<Response>;

let fetcher: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetcher = vi.fn(async () => new Response('should not be asked', { status: 500 }));
	vi.stubGlobal('fetch', fetcher);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

async function call(handler: Handler, path: string, params: Record<string, string> = {}) {
	return handler({ url: new URL(path, SITE), params } as never);
}

function expectMoved(response: Response, location: string) {
	expect(response.status).toBe(308);
	expect(response.headers.get('location')).toBe(location);
	expect(response.headers.get('cache-control')).toBe(CACHE_CONTROL.list);
}

describe('stray query parameters', () => {
	it('drops unknown and repeated keys and keeps the rest exactly as sent', () => {
		const url = new URL('/api/search?q=gear%20bots&x=1&q=other&limit=5&_=123', SITE);
		expect(withoutStrayQuery(url, ['q', 'limit'])).toBe('/api/search?q=gear%20bots&limit=5');
		expect(withoutStrayQuery(new URL('/og/site.png?v=2', SITE), [])).toBe('/og/site.png');
		expect(withoutStrayQuery(new URL('/og/site.png?', SITE), [])).toBeNull();
		expect(withoutStrayQuery(new URL('/api/search?q=a&&', SITE), ['q'])).toBe('/api/search?q=a');
		expect(withoutStrayQuery(new URL('/api/search?q=a&limit=3', SITE), ['q', 'limit'])).toBeNull();
	});

	it('never builds a link to another site', () => {
		const url = new URL(`${SITE}//evil.example/og/site.png?x=1`);
		expect(withoutStrayQuery(url, [])).toBe('/evil.example/og/site.png');
		expect(canonicalRedirect(url, '')?.headers.get('location')).toBe('/evil.example/og/site.png');
	});

	it('only redirects reads on endpoints it knows', () => {
		const url = new URL('/og/teams/2844.png?cache=bust', SITE);
		expectMoved(strayQueryRedirect('GET', '/og/[...path]', url)!, '/og/teams/2844.png');
		expect(strayQueryRedirect('HEAD', '/og/[...path]', url)?.status).toBe(308);
		expect(strayQueryRedirect('PUT', '/og/[...path]', url)).toBeNull();
		expect(strayQueryRedirect('GET', '/(app)/events/[code]', url)).toBeNull();
		expect(strayQueryRedirect('GET', null, url)).toBeNull();
	});

	it('lists only routes that exist', () => {
		for (const id of Object.keys(ENDPOINT_QUERY)) {
			expect(existsSync(`${root}${id}/+server.ts`), id).toBe(true);
		}
	});

	it('are redirected by the hook before anything renders', async () => {
		const url = new URL('/og/teams/2844.png?r=0.123', SITE);
		const response = await handle({
			event: { url, request: new Request(url), route: { id: '/og/[...path]' } },
			resolve: async () => {
				throw new Error('rendered a busted card');
			}
		} as never);
		expectMoved(response, '/og/teams/2844.png');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
	});
});

describe('canonical query strings', () => {
	it('redirect only when the query differs', () => {
		const url = new URL('/records.csv?part=auto', SITE);
		expect(canonicalRedirect(url, '?part=auto')).toBeNull();
		expectMoved(canonicalRedirect(url, '')!, '/records.csv');
	});

	it('send badges with junk options to the one real address', async () => {
		expectMoved(await call(badgeRoute, '/badge/2844.svg?stat=nope', { number: '2844' }), '/badge/2844.svg');
		expectMoved(
			await call(badgeRoute, '/badge/2844.svg?theme=dark&stat=opr&x=1', { number: '2844' }),
			'/badge/2844.svg?stat=opr&theme=dark'
		);
		expectMoved(
			await call(cardRoute, '/badge/2844/card.svg?theme=light', { number: '2844' }),
			'/badge/2844/card.svg'
		);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('leave badge links the site hands out alone', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		for (const kind of ['summary', 'card', 'opr', 'next'] as const) {
			for (const theme of ['light', 'dark'] as const) {
				const route = kind === 'card' ? cardRoute : badgeRoute;
				const response = await call(route, badgePath(2844, kind, theme), { number: '2844' });
				expect(response.status, `${kind} ${theme}`).not.toBe(308);
			}
		}
	});

	it('sort and dedupe followed teams so every list has one address', async () => {
		expectMoved(await call(followingRoute, '/api/following?teams=3,1,2,1'), '/api/following?teams=1,2,3');
		expectMoved(await call(followingRoute, '/api/following?teams=1,2&t=9'), '/api/following?teams=1,2');
		expectMoved(await call(followingRoute, '/api/following?teams=x'), '/api/following');
		expect(teamListQuery([12, 5, 5])).toBe('5,12');
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('redirect exports with junk filters before loading anything', async () => {
		expectMoved(await call(recordsCsv, '/records.csv?part=hive&page=4&x=1'), '/records.csv?part=hive');
		expectMoved(
			await call(leaderboardCsv, '/leaderboards.csv?sort=nope&team=2844&cb=1'),
			'/leaderboards.csv'
		);
		expectMoved(
			await call(insightsCsv, '/events/USAZGIQ/insights.csv?sort=bogus', { code: 'USAZGIQ' }),
			'/events/USAZGIQ/insights.csv'
		);
		expectMoved(
			await call(rankingsCsv, '/events/USAZGIQ/rankings.csv?dir=sideways&z=1', { code: 'USAZGIQ' }),
			'/events/USAZGIQ/rankings.csv'
		);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('keep the export links the pages build', () => {
		const records = recordQuery({ ...parseRecordFilters(new URLSearchParams('part=auto&range=week&region=USCA&team=2844&level=qual')), page: 1 });
		expect(recordQuery({ ...parseRecordFilters(new URLSearchParams(records.slice(1))), page: 1 })).toBe(records);
		const board = queryString({ ...parseFilters(new URLSearchParams('region=usca&type=qualifier&from=2026-10-01&to=2026-11-01&min=3&sort=auto&q=gear bots')), team: 0 }, 1);
		expect(queryString({ ...parseFilters(new URLSearchParams(board.slice(1))), team: 0 }, 1)).toBe(board);
		const insights = insightQuery(parseInsightFilters(new URLSearchParams('sort=auto&level=qual')));
		expect(insightQuery(parseInsightFilters(new URLSearchParams(insights.slice(1))))).toBe(insights);
		const rankings = rankingQuery(parseRankingChoice(new URLSearchParams('sort=opr&dir=asc')));
		expect(rankingQuery(parseRankingChoice(new URLSearchParams(rankings.slice(1))))).toBe(rankings);
	});

	it('send compare and simulator pages with extra keys to their clean address', async () => {
		const run = (load: Handler, path: string) =>
			Promise.resolve(load({ url: new URL(path, SITE), setHeaders: () => {} } as never));
		await expect(run(compareLoad, '/compare?teams=2844,724&utm_source=x')).rejects.toMatchObject({
			status: 303,
			location: '/compare?teams=2844,724'
		});
		await expect(run(compareLoad, '/compare?teams=2844&teams=724')).rejects.toMatchObject({
			status: 303,
			location: '/compare?teams=2844'
		});
		await expect(run(simulateLoad, '/simulate?red=1,2&blue=3,4&r=9')).rejects.toMatchObject({
			status: 303,
			location: '/simulate?red=1,2&blue=3,4'
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('treat simulator links with extra keys as not canonical', () => {
		const params = new URLSearchParams('red=724,10662&blue=5026,4133');
		const sides = parseSides(params);
		expect(isCanonical(params, sides)).toBe(true);
		expect(isCanonical(new URLSearchParams(`${params}&utm=x`), sides)).toBe(false);
		expect(isCanonical(new URLSearchParams(`${params}&red=1`), sides)).toBe(false);
	});
});
