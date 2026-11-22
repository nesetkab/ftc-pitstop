import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { replayStart } from '#lib/game/replay.ts';
import { fixtureBundle } from './fixtures.ts';
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
