import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRemoteStore } from '#lib/workspace/remote-store.ts';
import { emptyDoc } from '#lib/workspace/schemas.ts';

const meta = { code: 'ABC234', teamNumber: 3747, createdAt: 1_795_000_000_000 };

function reply(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

function setup() {
	let changes = 0;
	const loads: number[] = [];
	const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		if (init?.method === 'PUT') return reply({ updatedAt: Date.now() });
		loads.push(Date.now());
		if (changes > 0) {
			changes--;
			const checklist = { updatedAt: Date.now(), data: emptyDoc('checklist') };
			return reply({ meta, docs: { checklist } });
		}
		return reply({ meta, docs: {} });
	});
	const store = createRemoteStore({
		fetch: fetch as typeof globalThis.fetch,
		isVisible: () => true
	});
	const onChange = vi.fn();
	if (!store.watch) throw new Error('A shared workspace store can be watched');
	const stop = store.watch('ABC234', () => ({}), onChange);
	return {
		store,
		onChange,
		stop,
		loads,
		change: () => changes++
	};
}

function gapsAfter(loads: number[], start: number) {
	return loads.slice(start).map((time, index, all) => (index === 0 ? 0 : time - all[index - 1]));
}

describe('shared workspace polling', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(1_795_000_000_000);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('slows down to every 30 seconds while nothing changes', async () => {
		const { loads, stop } = setup();
		await vi.advanceTimersByTimeAsync(10_000 + 15_000 + 22_500 + 30_000 + 30_000);
		stop();
		expect(gapsAfter(loads, 0)).toEqual([0, 15_000, 22_500, 30_000, 30_000]);
	});

	it('goes back to every 10 seconds when a teammate changes something', async () => {
		const { loads, stop, change, onChange } = setup();
		await vi.advanceTimersByTimeAsync(10_000 + 15_000 + 22_500);
		change();
		await vi.advanceTimersByTimeAsync(30_000 + 10_000 + 15_000);
		stop();
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(gapsAfter(loads, 2)).toEqual([0, 30_000, 10_000, 15_000]);
	});

	it('polls quickly again after a local edit', async () => {
		const { store, loads, stop } = setup();
		await vi.advanceTimersByTimeAsync(10_000 + 15_000 + 22_500 + 30_000);
		await store.write('ABC234', 'checklist', emptyDoc('checklist'), null);
		await vi.advanceTimersByTimeAsync(10_000 + 10_000);
		stop();
		expect(gapsAfter(loads, 3)).toEqual([0, 10_000, 10_000]);
	});

	it('stops polling once the watcher is stopped', async () => {
		const { loads, stop } = setup();
		await vi.advanceTimersByTimeAsync(10_000);
		stop();
		await vi.advanceTimersByTimeAsync(120_000);
		expect(loads).toHaveLength(1);
	});
});
