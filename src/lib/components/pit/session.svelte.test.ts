import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { retime } from '#lib/analysis/analyze.ts';
import { nowView } from '#lib/components/event/now.ts';
import { fakeAnalysis } from '#lib/components/event/test-fixtures.ts';
import { replayBundle, replayStart } from '#lib/game/replay.ts';
import type { EventBundle, QueueStatusSnapshot } from '#lib/types.ts';
import { fixtureBundle } from './fixtures.ts';
import { BUNDLE_INTERVAL, QUEUE_INTERVAL } from './poll.ts';
import { analysisLoader, PitSession, type SessionOptions } from './session.svelte.ts';

const full = fixtureBundle('USAZGIQ');
const q23 = full.matches.find((match) => match.key === 'q23')!;

function options(start: number): SessionOptions {
	return {
		team: 14624,
		code: 'USAZGIQ',
		bundle: full,
		analysis: null,
		queue: null,
		nexus: false,
		replay: { start, speed: 1 }
	};
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('PitSession', () => {
	it('is created once per page data, not on every clock tick', () => {
		let created = 0;
		let session: PitSession | null = null;
		const stop = $effect.root(() => {
			const data = $state({ start: replayStart('Q22', full)! });
			const current = $derived.by(() => {
				created++;
				return new PitSession(options(data.start));
			});
			$effect(() => {
				session = current;
				void current.view;
			});
		});
		flushSync();
		const first = session!;
		first.now += 5000;
		flushSync();
		first.now += 5000;
		flushSync();
		expect(created).toBe(1);
		expect(session).toBe(first);
		stop();
	});

	it('rebuilds a live view on data changes, not on every clock tick', () => {
		const start = replayStart('Q20', full)!;
		const snapshot = replayBundle(full, start);
		const session = new PitSession({
			...options(start),
			replay: null,
			bundle: snapshot,
			analysis: retime(fakeAnalysis(snapshot), snapshot, start)
		});
		session.now = 60_000 * Math.ceil(start / 60_000);
		const first = session.view;
		session.now += 1000;
		expect(session.view).toBe(first);
		session.now += 14_000;
		expect(session.view).not.toBe(first);
	});

	it('replays the event on its clock and keeps a tapped takeover closed', () => {
		const session = new PitSession(options(q23.actualTime!));
		const stop = $effect.root(() => {
			$effect(() => void session.takeover);
		});
		flushSync();
		expect(session.view?.next?.key).toBe('q26');
		expect(session.takeover?.key).toBe('q26');
		session.dismiss();
		flushSync();
		expect(session.takeover).toBeNull();
		expect(session.call?.key).toBe('q26');
		stop();
	});

	it('keeps match times current between analysis updates, like the Now tab', () => {
		const start = replayStart('Q20', full)!;
		const snapshot = replayBundle(full, start);
		const loaded = retime(fakeAnalysis(snapshot), snapshot, start);
		const session = new PitSession({ ...options(start), analysis: loaded });
		session.now += 25 * 60_000;
		const next = session.view!.next!;
		const now = nowView({
			bundle: session.bundle!,
			analysis: loaded,
			queue: null,
			baseline: null,
			now: session.clock
		});
		const listed = [now.onField, ...now.upcoming].find((match) => match?.key === next.key);
		expect(next.expectedStart).not.toBe(loaded.timing.matches[next.key].expectedStart);
		expect(next.expectedStart).toBe(listed?.expected);
		expect(session.view!.delaySeconds).toBe(now.delaySeconds);
	});
});

describe('PitSession polling on a page', () => {
	it('keeps refreshing scores while Nexus queue updates keep arriving', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(Date.parse('2026-11-14T19:00:00Z'));
		const live: EventBundle = { ...full, phase: 'quals' };
		const queue: QueueStatusSnapshot = {
			eventKey: 'USAZGIQ',
			dataAsOfTime: Date.now(),
			nowQueuing: null,
			matches: [],
			announcements: []
		};
		const fetcher = vi.fn(async (input: RequestInfo | URL) =>
			String(input).includes('/api/nexus/')
				? Response.json({ ...queue, dataAsOfTime: Date.now() })
				: Response.json({ ...live, fetchedAt: Date.now() })
		);
		const session = new PitSession({
			...options(0),
			bundle: live,
			queue,
			nexus: true,
			replay: null,
			fetch: fetcher as unknown as typeof fetch
		});
		const stop = $effect.root(() => {
			$effect(() => session.start());
		});
		flushSync();
		const minutes = 2;
		for (let second = 0; second < minutes * 60; second++) {
			await vi.advanceTimersByTimeAsync(1000);
			flushSync();
		}
		const count = (part: string) =>
			fetcher.mock.calls.filter(([url]) => String(url).includes(part)).length;
		expect(count('/lite')).toBe((minutes * 60_000) / BUNDLE_INTERVAL);
		expect(count('/api/nexus/')).toBe((minutes * 60_000) / QUEUE_INTERVAL);
		stop();
	});
});

describe('analysisLoader', () => {
	it('reads live analysis from the shared CDN cache, one address per data version', async () => {
		const fetcher = vi.fn(async () => Response.json({ code: 'USAZGIQ' }));
		const replay = vi.fn(async () => null);
		const load = analysisLoader(replay, fetcher as unknown as typeof fetch);
		expect(await load({ code: 'USAZGIQ', at: null, version: 'USAZGIQ:quals:44:3' })).toEqual({
			code: 'USAZGIQ'
		});
		expect(fetcher).toHaveBeenCalledWith('/api/events/USAZGIQ/analysis?v=USAZGIQ%3Aquals%3A44%3A3');
		expect(replay).not.toHaveBeenCalled();
	});

	it('leaves replays to the server function and reports failures', async () => {
		const fetcher = vi.fn(async () => new Response('down', { status: 503 }));
		const replay = vi.fn(async () => null);
		const load = analysisLoader(replay, fetcher as unknown as typeof fetch);
		await load({ code: 'USAZGIQ', at: 5, version: 'v' });
		expect(replay).toHaveBeenCalledOnce();
		expect(fetcher).not.toHaveBeenCalled();
		await expect(load({ code: 'USAZGIQ', at: null, version: 'v' })).rejects.toThrow();
	});
});
