import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import { replayStart } from '#lib/game/replay.ts';
import { fixtureBundle } from './fixtures.ts';
import { PitSession, type SessionOptions } from './session.svelte.ts';

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
