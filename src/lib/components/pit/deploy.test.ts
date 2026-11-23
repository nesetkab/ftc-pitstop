import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	reloadDue,
	reloadOntoNewBuild,
	VERSION_CHECK,
	watchDeploys,
	WORKER_WAIT,
	type Workers
} from './deploy.ts';

afterEach(() => vi.useRealTimers());

const call = { key: 'q12', label: 'Q12', alliance: 'red' as const, reason: 'timing' as const };

describe('pit screens after a deploy', () => {
	it('reload onto the new build only when nothing is on screen for us', () => {
		expect(reloadDue({ updated: false, replay: null, call: null })).toBe(false);
		expect(reloadDue({ updated: true, replay: null, call: null })).toBe(true);
		expect(reloadDue({ updated: true, replay: null, call })).toBe(false);
		expect(reloadDue({ updated: true, replay: { start: 0, speed: 60 }, call: null })).toBe(false);
	});

	it('check for a new build on a slow timer and stop when the page closes', () => {
		vi.useFakeTimers();
		const check = vi.fn(async () => false);
		const stop = watchDeploys(check);
		vi.advanceTimersByTime(VERSION_CHECK - 1);
		expect(check).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(check).toHaveBeenCalledTimes(1);
		stop();
		vi.advanceTimersByTime(VERSION_CHECK * 3);
		expect(check).toHaveBeenCalledTimes(1);
	});

	it('check again as soon as a new service worker takes over', () => {
		const { workers, takeOver } = fakeWorkers({});
		const check = vi.fn(async () => false);
		const stop = watchDeploys(check, VERSION_CHECK, workers);
		takeOver();
		expect(check).toHaveBeenCalledTimes(1);
		stop();
		takeOver();
		expect(check).toHaveBeenCalledTimes(1);
	});
});

function fakeWorkers(registration: { installing?: unknown; waiting?: unknown } | null) {
	const listeners = new Set<() => void>();
	const update = vi.fn(async () => undefined);
	const workers: Workers = {
		getRegistration: async () =>
			registration
				? {
						installing: registration.installing ?? null,
						waiting: registration.waiting ?? null,
						update
					}
				: undefined,
		addEventListener: (_type, listener) => listeners.add(listener),
		removeEventListener: (_type, listener) => listeners.delete(listener)
	};
	const takeOver = () => {
		for (const listener of [...listeners]) listener();
	};
	return { workers, takeOver, update, listeners };
}

describe('reloading onto a new build', () => {
	it('lets the new service worker take over before reloading', async () => {
		const { workers, takeOver, update } = fakeWorkers({ installing: {} });
		const reload = vi.fn();
		const done = reloadOntoNewBuild(reload, workers);
		await vi.waitFor(() => expect(update).toHaveBeenCalled());
		await Promise.resolve();
		expect(reload).not.toHaveBeenCalled();
		takeOver();
		await done;
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('reloads right away when no new worker is on its way', async () => {
		const { workers, update, listeners } = fakeWorkers({});
		const reload = vi.fn();
		await reloadOntoNewBuild(reload, workers);
		expect(update).toHaveBeenCalled();
		expect(reload).toHaveBeenCalledTimes(1);
		expect(listeners.size).toBe(0);
	});

	it('does not wait forever for a worker that never takes over', async () => {
		vi.useFakeTimers();
		const { workers, listeners } = fakeWorkers({ waiting: {} });
		const reload = vi.fn();
		const done = reloadOntoNewBuild(reload, workers);
		await vi.advanceTimersByTimeAsync(WORKER_WAIT);
		await done;
		expect(reload).toHaveBeenCalledTimes(1);
		expect(listeners.size).toBe(0);
	});

	it('still reloads without a service worker', async () => {
		const reload = vi.fn();
		await reloadOntoNewBuild(reload, undefined);
		await reloadOntoNewBuild(reload, fakeWorkers(null).workers);
		const broken: Workers = {
			getRegistration: async () => Promise.reject(new Error('denied')),
			addEventListener: () => undefined,
			removeEventListener: () => undefined
		};
		await reloadOntoNewBuild(reload, broken);
		expect(reload).toHaveBeenCalledTimes(3);
	});
});
