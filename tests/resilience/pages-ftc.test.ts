import { describe, expect, it, vi } from 'vitest';
import {
	bundleOf,
	CODE,
	expectAllOk,
	expectGraceful,
	find,
	onEventDay,
	PAGE_BUDGET_MS,
	sharedMaxAge,
	TEAM,
	visit
} from './pages.ts';

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

describe('pages when the FTC API fails', () => {
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
});
