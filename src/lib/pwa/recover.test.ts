import { describe, expect, it, vi } from 'vitest';
import { recoverWorker, type RecoverDeps } from './recover.ts';
import { isStaleWorker } from './rules.ts';

function deps(keys: string[], overrides: Partial<RecoverDeps> = {}) {
	const unregister = vi.fn(async () => true);
	const remove = vi.fn(async (_key: string) => true);
	const mark = vi.fn();
	const registration = { installing: null, waiting: null, unregister };
	const value: RecoverDeps = {
		controlled: true,
		registration: async () => registration,
		keys: async () => keys,
		remove,
		done: () => null,
		mark,
		...overrides
	};
	return { value, unregister, remove, mark, registration };
}

describe('isStaleWorker', () => {
	it('flags a worker whose shell is older than the page', () => {
		expect(isStaleWorker(['pitstop-data', 'pitstop-shell-100'], '200', false)).toBe(true);
		expect(isStaleWorker(['pitstop-pages-100', 'sveltekit:200'], '200', false)).toBe(true);
	});

	it('leaves a current or newer worker alone', () => {
		expect(isStaleWorker(['pitstop-shell-200', 'pitstop-data-200'], '200', false)).toBe(false);
		expect(isStaleWorker(['pitstop-shell-300'], '200', false)).toBe(false);
	});

	it('waits while an update is installing and ignores other caches', () => {
		expect(isStaleWorker(['pitstop-shell-100'], '200', true)).toBe(false);
		expect(isStaleWorker(['sveltekit:200'], '200', false)).toBe(false);
		expect(isStaleWorker([], '200', false)).toBe(false);
	});
});

describe('recoverWorker', () => {
	it('unregisters a stuck worker and clears only its caches, once per build', async () => {
		const stuck = deps(['pitstop-data', 'pitstop-shell-100', 'sveltekit:200']);
		expect(await recoverWorker('200', stuck.value)).toBe(true);
		expect(stuck.unregister).toHaveBeenCalledOnce();
		expect(stuck.remove.mock.calls.map(([key]) => key)).toEqual([
			'pitstop-data',
			'pitstop-shell-100'
		]);
		expect(stuck.mark).toHaveBeenCalledWith('200');
	});

	it('does nothing when the worker is current, pending, absent or already reset', async () => {
		const current = deps(['pitstop-shell-200']);
		expect(await recoverWorker('200', current.value)).toBe(false);
		const pending = deps(['pitstop-shell-100']);
		pending.registration.waiting = {} as never;
		expect(await recoverWorker('200', pending.value)).toBe(false);
		expect(
			await recoverWorker('200', deps(['pitstop-shell-100'], { controlled: false }).value)
		).toBe(false);
		expect(
			await recoverWorker('200', deps(['pitstop-shell-100'], { done: () => '200' }).value)
		).toBe(false);
		const none = deps(['pitstop-shell-100'], { registration: async () => undefined });
		expect(await recoverWorker('200', none.value)).toBe(false);
		for (const run of [current, pending]) expect(run.unregister).not.toHaveBeenCalled();
	});
});
