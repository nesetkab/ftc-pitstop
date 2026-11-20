import { afterEach, describe, expect, it, vi } from 'vitest';
import { PitFeed } from './feed.svelte.ts';
import { fixtureBundle } from './fixtures.ts';
import { BUNDLE_INTERVAL } from './poll.ts';

afterEach(() => {
	vi.useRealTimers();
});

describe('PitFeed', () => {
	it('keeps the last good bundle when a new one has lost its matches', async () => {
		vi.useFakeTimers();
		const good = fixtureBundle('USAZGIQ');
		const degraded = { ...good, matches: [], rankings: [] };
		const fetch = vi.fn(async () => new Response(JSON.stringify(degraded), { status: 200 }));
		const feed = new PitFeed({ code: 'USAZGIQ', bundle: good, queue: null, nexus: false, fetch });
		const stop = feed.start();
		await vi.advanceTimersByTimeAsync(BUNDLE_INTERVAL);
		stop();
		expect(fetch).toHaveBeenCalledOnce();
		expect(feed.bundle?.matches).toHaveLength(good.matches.length);
		expect(feed.failures).toBe(1);
	});
});
