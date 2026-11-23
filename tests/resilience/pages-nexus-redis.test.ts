import { describe, expect, it, vi } from 'vitest';
import {
	bundleOf,
	CODE,
	expectAllOk,
	expectGraceful,
	find,
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

describe('pages when Nexus or Redis fail', () => {
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
});
