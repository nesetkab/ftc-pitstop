import { describe, expect, it, vi } from 'vitest';
import {
	bundleOf,
	CODE,
	EVENT_DAY,
	expectAllOk,
	expectGraceful,
	find,
	importPages,
	onEventDay,
	PAGE_BUDGET_MS,
	TEAM,
	visit,
	visitAll
} from './pages.ts';
import { fakeUpstreams } from './upstream.ts';

vi.mock('$app/env/private', () => ({
	FTC_USERNAME: 'tester',
	FTC_API_KEY: 'not-a-real-key',
	NEXUS_API_KEY: 'not-a-real-nexus-key',
	KV_REST_API_URL: 'https://fake-redis.upstash.io',
	KV_REST_API_TOKEN: 'fake-token-123456',
	UPSTASH_REDIS_REST_URL: undefined,
	UPSTASH_REDIS_REST_TOKEN: undefined
}));

onEventDay();

describe('pages when upstreams are healthy', () => {
	it('serves every page', async () => {
		const { outcomes } = await visit({});
		expectAllOk(outcomes);
		expectGraceful(outcomes, PAGE_BUDGET_MS);
		expect(bundleOf(find(outcomes, `/events/${CODE}#layout`))).toMatchObject({
			source: 'ftc',
			stale: false
		});
	});
});

describe('last good data', () => {
	it('keeps showing the event with a stale flag after the FTC API goes down', async () => {
		const upstreams = fakeUpstreams();
		vi.stubGlobal('fetch', upstreams.fetch);
		const pages = await importPages();
		const before = bundleOf(find(await visitAll(pages), `/api/events/${CODE}/lite`));
		expect(before).toMatchObject({ source: 'ftc', stale: false });

		upstreams.set({ ftc: 'error', scout: 'down' });
		vi.setSystemTime(EVENT_DAY + 10 * 60_000);
		await visitAll(pages);
		await new Promise((resolve) => setTimeout(resolve, 2_000));
		const outcomes = await visitAll(pages);
		expectGraceful(outcomes, PAGE_BUDGET_MS);
		for (const page of [`/api/events/${CODE}/lite`, `/events/${CODE}#layout`, `/${TEAM}`]) {
			const outcome = find(outcomes, page);
			expect(outcome.status, page).toBe(200);
			const bundle = bundleOf(outcome);
			expect(bundle, page).toMatchObject({ source: 'ftc', stale: true });
			expect(bundle.matches, page).toHaveLength(before.matches.length);
		}
		const ftcCalls = upstreams.calls.ftc;
		await visitAll(pages);
		expect(upstreams.calls.ftc - ftcCalls).toBeLessThan(5);
	}, 30_000);
});

describe('error responses', () => {
	it('strips CDN caching from server errors but leaves good pages alone', async () => {
		const { handle } = await import('../../src/hooks.server.ts');
		const run = (status: number) =>
			handle({
				event: { url: new URL('http://localhost/events/USAZGIQ') },
				resolve: async () =>
					new Response('x', {
						status,
						headers: {
							'content-type': 'text/html',
							'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800'
						}
					})
			} as never) as Promise<Response>;
		expect((await run(503)).headers.get('cache-control')).toBe('no-store');
		expect((await run(500)).headers.get('cache-control')).toBe('no-store');
		expect((await run(200)).headers.get('cache-control')).toContain('s-maxage=86400');
		expect((await run(404)).headers.get('cache-control')).toContain('s-maxage');
	});
});
