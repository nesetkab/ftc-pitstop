import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_HEADER } from '#lib/pwa/rules.ts';
import type { EventBundle } from '#lib/types.ts';
import { PitFeed } from './feed.svelte.ts';
import { fixtureBundle } from './fixtures.ts';
import {
	BUNDLE_INTERVAL,
	bundleDelay,
	DONE_INTERVAL,
	QUEUE_INTERVAL,
	queueActive,
	QUIET_INTERVAL
} from './poll.ts';

const EVENT_DAY = Date.parse('2026-11-14T19:00:00Z');
const WEEK_LATER = Date.parse('2026-11-21T19:00:00Z');
const WEEK_BEFORE = Date.parse('2026-11-07T19:00:00Z');

const done = fixtureBundle('USAZGIQ');
const live: EventBundle = { ...done, phase: 'quals' };
const awaitingAwards: EventBundle = { ...done, awards: [] };

let hidden = false;

beforeEach(() => {
	hidden = false;
	vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() =>
		hidden ? 'hidden' : 'visible'
	);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function respond(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status });
}

function feedFor(
	bundle: EventBundle,
	options: { nexus?: boolean; pollHidden?: () => boolean } = {}
) {
	const fetch = vi.fn(async (input: RequestInfo | URL) =>
		String(input).includes('/api/nexus/') ? respond({ matches: [] }) : respond(bundle)
	);
	const feed = new PitFeed({
		code: 'USAZGIQ',
		bundle,
		queue: null,
		nexus: options.nexus ?? false,
		fetch,
		pollHidden: options.pollHidden
	});
	const calls = (part: string) => fetch.mock.calls.filter(([url]) => String(url).includes(part));
	return { feed, fetch, calls };
}

describe('poll timing', () => {
	it('polls every few seconds while matches are being played', () => {
		expect(bundleDelay(null, EVENT_DAY)).toBe(BUNDLE_INTERVAL);
		for (const phase of ['quals', 'selection', 'playoffs'] as const) {
			expect(bundleDelay({ ...done, phase }, WEEK_LATER)).toBe(BUNDLE_INTERVAL);
		}
		expect(bundleDelay({ ...done, phase: 'upcoming' }, EVENT_DAY)).toBe(BUNDLE_INTERVAL);
	});

	it('keeps polling quickly after the final until the winners are announced', () => {
		expect(bundleDelay(awaitingAwards, EVENT_DAY)).toBe(BUNDLE_INTERVAL);
		expect(bundleDelay(done, EVENT_DAY)).toBe(DONE_INTERVAL);
	});

	it('slows down before event day and stops once a finished event is over', () => {
		expect(bundleDelay({ ...done, phase: 'upcoming' }, WEEK_BEFORE)).toBe(QUIET_INTERVAL);
		expect(bundleDelay(awaitingAwards, WEEK_LATER)).toBe(QUIET_INTERVAL);
		expect(bundleDelay(done, WEEK_LATER)).toBeNull();
	});

	it('only watches the queue on event day before the event is done', () => {
		expect(queueActive(live, EVENT_DAY)).toBe(true);
		expect(queueActive({ ...done, phase: 'upcoming' }, EVENT_DAY)).toBe(true);
		expect(queueActive(done, EVENT_DAY)).toBe(false);
		expect(queueActive(live, WEEK_BEFORE)).toBe(false);
		expect(queueActive(null, EVENT_DAY)).toBe(false);
	});
});

describe('PitFeed', () => {
	it('keeps the last good bundle when a new one has lost its matches', async () => {
		vi.useFakeTimers({ now: EVENT_DAY });
		const degraded = { ...live, matches: [], rankings: [] };
		const fetch = vi.fn(async () => respond(degraded));
		const feed = new PitFeed({ code: 'USAZGIQ', bundle: live, queue: null, nexus: false, fetch });
		const stop = feed.start();
		await vi.advanceTimersByTimeAsync(BUNDLE_INTERVAL);
		stop();
		expect(fetch).toHaveBeenCalledOnce();
		expect(feed.bundle?.matches).toHaveLength(live.matches.length);
		expect(feed.failures).toBe(1);
	});

	it('asks for the small bundle without score breakdowns', async () => {
		vi.useFakeTimers({ now: EVENT_DAY });
		const { feed, fetch } = feedFor(live);
		const stop = feed.start();
		await vi.advanceTimersByTimeAsync(BUNDLE_INTERVAL);
		stop();
		expect(fetch).toHaveBeenCalledWith('/api/events/USAZGIQ/lite');
	});

	it('stops asking while the screen is hidden and catches up when it comes back', async () => {
		vi.useFakeTimers({ now: EVENT_DAY });
		const { feed, calls } = feedFor(live, { nexus: true });
		const stop = feed.start();
		await vi.advanceTimersByTimeAsync(BUNDLE_INTERVAL);
		const before = calls('/lite').length;
		hidden = true;
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(calls('/lite')).toHaveLength(before);
		const queued = calls('/api/nexus/').length;
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(calls('/api/nexus/')).toHaveLength(queued);
		hidden = false;
		document.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(0);
		expect(calls('/lite')).toHaveLength(before + 1);
		expect(calls('/api/nexus/')).toHaveLength(queued + 1);
		stop();
	});

	it('keeps polling in the background when match alerts are on', async () => {
		vi.useFakeTimers({ now: EVENT_DAY });
		const { feed, calls } = feedFor(live, { pollHidden: () => true });
		hidden = true;
		const stop = feed.start();
		await vi.advanceTimersByTimeAsync(4 * BUNDLE_INTERVAL);
		stop();
		expect(calls('/lite')).toHaveLength(4);
	});

	it('stops polling a finished event and leaves the queue alone', async () => {
		vi.useFakeTimers({ now: WEEK_LATER });
		const { feed, fetch } = feedFor(done, { nexus: true });
		const stop = feed.start();
		await vi.advanceTimersByTimeAsync(60 * 60_000);
		stop();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('polls slowly once the winners are in and starts the queue when the event goes live', async () => {
		vi.useFakeTimers({ now: EVENT_DAY });
		const { feed, calls } = feedFor(done, { nexus: true });
		const stop = feed.start();
		await vi.advanceTimersByTimeAsync(DONE_INTERVAL * 3);
		expect(calls('/lite')).toHaveLength(3);
		expect(calls('/api/nexus/')).toHaveLength(0);
		stop();

		const second = feedFor(live, { nexus: true });
		const stopLive = second.feed.start();
		await vi.advanceTimersByTimeAsync(QUEUE_INTERVAL * 3);
		stopLive();
		expect(second.calls('/api/nexus/').length).toBeGreaterThanOrEqual(3);
	});

	it('shows newer cached data when offline but still reports the failure', async () => {
		vi.useFakeTimers({ now: EVENT_DAY });
		const newer = { ...live, fetchedAt: live.fetchedAt + 60_000 };
		const cached = () =>
			new Response(JSON.stringify(newer), { headers: { [OFFLINE_HEADER]: '1' } });
		const fetch = vi.fn(async () => cached());
		const feed = new PitFeed({ code: 'USAZGIQ', bundle: live, queue: null, nexus: false, fetch });
		const updatedAt = feed.updatedAt;
		const stop = feed.start();
		await vi.advanceTimersByTimeAsync(BUNDLE_INTERVAL);
		stop();
		expect(feed.bundle?.fetchedAt).toBe(newer.fetchedAt);
		expect(feed.failures).toBe(1);
		expect(feed.updatedAt).toBe(updatedAt);
	});

	it('ignores cached data older than what the page already shows', async () => {
		vi.useFakeTimers({ now: EVENT_DAY });
		const older = { ...live, fetchedAt: live.fetchedAt - 60_000 };
		const fetch = vi.fn(
			async () => new Response(JSON.stringify(older), { headers: { [OFFLINE_HEADER]: '1' } })
		);
		const feed = new PitFeed({ code: 'USAZGIQ', bundle: live, queue: null, nexus: false, fetch });
		const stop = feed.start();
		await vi.advanceTimersByTimeAsync(BUNDLE_INTERVAL);
		stop();
		expect(feed.bundle?.fetchedAt).toBe(live.fetchedAt);
	});

	it('checks right away when the page opens offline', async () => {
		vi.useFakeTimers({ now: WEEK_LATER });
		vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
		const { feed, calls } = feedFor(done);
		const stop = feed.start();
		await vi.advanceTimersByTimeAsync(0);
		stop();
		expect(feed.online).toBe(false);
		expect(calls('/lite')).toHaveLength(1);
	});
});
