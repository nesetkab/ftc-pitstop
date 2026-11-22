import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventBundle } from '#lib/types.ts';
import { CODE, find, importPages, TEAM, visitAll, type Outcome } from './pages.ts';
import { fakeUpstreams, type Modes } from './upstream.ts';

vi.mock('$app/env/private', () => ({
	FTC_USERNAME: 'tester',
	FTC_API_KEY: 'not-a-real-key',
	NEXUS_API_KEY: 'not-a-real-nexus-key',
	KV_REST_API_URL: 'https://fake-redis.upstash.io',
	KV_REST_API_TOKEN: 'fake-token-123456',
	UPSTASH_REDIS_REST_URL: undefined,
	UPSTASH_REDIS_REST_TOKEN: undefined
}));

const EVENT_DAY = Date.parse('2026-11-14T20:00:00Z');
const PAGE_BUDGET_MS = 5_500;
const OUTAGE_BUDGET_MS = 9_000;
const NEEDS_SCOUT = new Set(['/leaderboards', '/records']);

beforeEach(() => {
	vi.resetModules();
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(EVENT_DAY);
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

async function visit(modes: Partial<Modes>) {
	const upstreams = fakeUpstreams(modes);
	vi.stubGlobal('fetch', upstreams.fetch);
	const pages = await importPages();
	return { upstreams, pages, outcomes: await visitAll(pages) };
}

function bundleOf(outcome: Outcome): EventBundle {
	const data = outcome.data as { bundle?: EventBundle } & EventBundle;
	return data.bundle ?? data;
}

function sharedMaxAge(cacheControl: string | null): number {
	return Number(/s-maxage=(\d+)/.exec(cacheControl ?? '')?.[1] ?? 0);
}

function expectGraceful(outcomes: Outcome[], budgetMs: number, slow = new Set<string>()) {
	for (const outcome of outcomes) {
		expect(outcome.status, `${outcome.page}: ${outcome.message}`).not.toBe(500);
		expect([200, 503], outcome.page).toContain(outcome.status);
		expect(outcome.ms, outcome.page).toBeLessThan(slow.has(outcome.page) ? 7_000 : budgetMs);
	}
}

function expectAllOk(outcomes: Outcome[]) {
	for (const outcome of outcomes) {
		expect(outcome.status, `${outcome.page}: ${outcome.message}`).toBe(200);
	}
}

describe('pages when upstreams fail', () => {
	it('serves every page when everything is healthy', async () => {
		const { outcomes } = await visit({});
		expectAllOk(outcomes);
		expectGraceful(outcomes, PAGE_BUDGET_MS);
		expect(bundleOf(find(outcomes, `/events/${CODE}#layout`))).toMatchObject({
			source: 'ftc',
			stale: false
		});
	});

	it.each(['hang', 'error', 'denied', 'garbage'] as const)(
		'falls back to FTCScout when the FTC API is %s',
		async (ftc) => {
			const { outcomes } = await visit({ ftc });
			expectAllOk(outcomes);
			expectGraceful(outcomes, PAGE_BUDGET_MS);
			for (const page of [`/events/${CODE}#layout`, `/api/events/${CODE}/lite`, `/${TEAM}`]) {
				const bundle = bundleOf(find(outcomes, page));
				expect(bundle, page).toMatchObject({ source: 'ftcscout', stale: true });
				expect(bundle.matches.length, page).toBeGreaterThan(0);
			}
			const lite = find(outcomes, `/api/events/${CODE}/lite`);
			expect(sharedMaxAge(lite.cacheControl)).toBeLessThanOrEqual(300);
		},
		15_000
	);

	it.each(['down', 'hang'] as const)(
		'uses the FTC API alone when FTCScout is %s',
		async (scout) => {
			const { outcomes } = await visit({ scout });
			expectGraceful(outcomes, PAGE_BUDGET_MS, scout === 'hang' ? NEEDS_SCOUT : undefined);
			for (const outcome of outcomes) {
				if (!NEEDS_SCOUT.has(outcome.page)) expect(outcome.status, outcome.page).toBe(200);
			}
			expect(bundleOf(find(outcomes, `/events/${CODE}#layout`)).source).toBe('ftc');
			expect(find(outcomes, '/events').data).toMatchObject({ stale: true });
			expect(find(outcomes, `/${TEAM}`).data).toMatchObject({ state: 'ready' });
			for (const page of NEEDS_SCOUT) {
				expect(find(outcomes, page).message).toMatch(/still loading/);
			}
		},
		20_000
	);

	it.each(['down', 'hang', 'error'] as const)(
		'keeps the pit screens up when Nexus is %s',
		async (nexus) => {
			const { outcomes } = await visit({ nexus });
			expectAllOk(outcomes);
			expectGraceful(outcomes, PAGE_BUDGET_MS);
			for (const page of [`/${TEAM}`, `/${TEAM}/tv?event=${CODE}`]) {
				expect(find(outcomes, page).data).toMatchObject({
					state: 'ready',
					queue: null,
					nexus: true
				});
			}
		},
		15_000
	);

	it.each(['down', 'hang', 'error'] as const)(
		'skips the shared cache when Redis is %s',
		async (redis) => {
			const { outcomes } = await visit({ redis });
			expectAllOk(outcomes);
			expectGraceful(outcomes, PAGE_BUDGET_MS);
			expect(bundleOf(find(outcomes, `/api/events/${CODE}/lite`)).stale).toBe(false);
		},
		15_000
	);

	it('answers within budget and never caches errors when everything hangs', async () => {
		const { outcomes } = await visit({ ftc: 'hang', scout: 'hang', nexus: 'hang', redis: 'hang' });
		expectGraceful(outcomes, OUTAGE_BUDGET_MS);
		const lite = find(outcomes, `/api/events/${CODE}/lite`);
		expect(lite.status).toBe(503);
		expect(lite.cacheControl).toBe('no-store');
		for (const outcome of outcomes) {
			if (outcome.status === 503) expect(sharedMaxAge(outcome.cacheControl)).toBe(0);
		}
	}, 20_000);
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
		expectGraceful(outcomes, PAGE_BUDGET_MS, NEEDS_SCOUT);
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
