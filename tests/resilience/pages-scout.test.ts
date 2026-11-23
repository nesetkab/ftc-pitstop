import { describe, expect, it, vi } from 'vitest';
import {
	bundleOf,
	CODE,
	expectGraceful,
	find,
	NEEDS_SCOUT,
	onEventDay,
	PAGE_BUDGET_MS,
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

describe('pages when FTCScout fails', () => {
	it.each(['down', 'hang'] as const)(
		'uses the FTC API alone when FTCScout is %s',
		async (scout) => {
			const { outcomes } = await visit({ scout });
			expectGraceful(outcomes, PAGE_BUDGET_MS);
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
});
