import { describe, expect, it, vi } from 'vitest';
import {
	CODE,
	expectGraceful,
	find,
	onEventDay,
	OUTAGE_BUDGET_MS,
	sharedMaxAge,
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

describe('pages when every upstream hangs', () => {
	it('answers within budget and never caches errors', async () => {
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
