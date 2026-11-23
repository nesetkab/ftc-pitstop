import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureBundle } from '#lib/components/pit/fixtures.ts';
import { replayBundle, replayStart } from '#lib/game/replay.ts';
import { RELOAD_GAP } from './now.ts';
import { NowSession } from './now.svelte.ts';
import { fakeAnalysis } from './test-fixtures.ts';

const full = fixtureBundle('USAZGIQ');
const analysis = fakeAnalysis(full);
const at = (label: string) => replayStart(label, full)!;

afterEach(() => vi.restoreAllMocks());

function session(time: number) {
	const clock = { now: time };
	const reload = vi.fn();
	const bundle = { ...replayBundle(full, at('Q21')), fetchedAt: time };
	const now = new NowSession({
		bundle,
		analysis,
		replay: null,
		reload,
		now: () => clock.now,
		fetch: vi.fn()
	});
	return { now, clock, reload, bundle };
}

describe('NowSession', () => {
	it('builds the view from the layout data', () => {
		const { now } = session(at('Q21'));
		expect(now.view.rankedAfter).toBe('Q21');
		expect(now.view.upcoming[0].label).toBe('Q22');
	});

	it('shows newer live data and reloads the layout once it changes', () => {
		const time = at('Q22');
		const { now, clock, reload } = session(time);
		now.feed.bundle = { ...replayBundle(full, time), fetchedAt: time + 1 };
		expect(now.view.rankedAfter).toBe('Q22');
		now.check();
		expect(reload).not.toHaveBeenCalled();
		clock.now = time + RELOAD_GAP;
		now.check();
		expect(reload).toHaveBeenCalledTimes(1);
		now.check();
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('tracks rank movement between updates', () => {
		const time = at('Q22');
		const { now } = session(time);
		expect(now.view.since).toBeNull();
		now.feed.bundle = { ...replayBundle(full, time), fetchedAt: time + 1 };
		expect(now.baseline?.after).toBe('Q21');
		expect(now.view.since).toBe('Q21');
	});

	it('runs a replay on its own clock without polling Nexus or reloading', () => {
		const start = at('Q10');
		const clock = { now: 1_000 };
		const reload = vi.fn();
		const replay = new NowSession({
			bundle: full,
			analysis,
			replay: { start, speed: 60 },
			reload,
			now: () => clock.now,
			fetch: vi.fn()
		});
		expect(replay.feed.nexus).toBe(false);
		expect(replay.view.rankedAfter).toBe('Q10');
		clock.now += 20 * 60_000;
		replay.check();
		expect(replay.clock).toBe(start + 20 * 60_000 * 60);
		expect(replay.view.phase).not.toBe('quals');
		expect(reload).not.toHaveBeenCalled();
	});
});
