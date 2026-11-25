import { describe, expect, it, vi } from 'vitest';
import {
	createKeeper,
	OFFLINE_KEY,
	retireWorker,
	usedOffline,
	withoutHash,
	type KeepDeps,
	type RetireDeps
} from './register.ts';
import { CACHE_PAGE } from './rules.ts';

function keeper(overrides: Partial<KeepDeps> = {}) {
	const postMessage = vi.fn();
	const register = vi.fn(async () => ({}));
	const mark = vi.fn();
	const deps: KeepDeps = {
		served: null,
		register,
		ready: async () => ({ active: { postMessage } }),
		mark,
		...overrides
	};
	return { keep: createKeeper(deps), postMessage, register, mark };
}

describe('createKeeper', () => {
	it('registers once and asks the worker to save each page', async () => {
		const { keep, postMessage, register, mark } = keeper();
		await keep('https://pit.test/724#top');
		await keep('https://pit.test/724/tv');
		expect(register).toHaveBeenCalledTimes(1);
		expect(mark).toHaveBeenCalledTimes(2);
		expect(postMessage.mock.calls).toEqual([
			[{ type: CACHE_PAGE, url: 'https://pit.test/724' }],
			[{ type: CACHE_PAGE, url: 'https://pit.test/724/tv' }]
		]);
	});

	it('skips the page the worker already served', async () => {
		const { keep, postMessage, register } = keeper({ served: 'https://pit.test/w/ABC234' });
		await keep('https://pit.test/w/ABC234');
		expect(register).toHaveBeenCalledTimes(1);
		expect(postMessage).not.toHaveBeenCalled();
		await keep('https://pit.test/w/ABC234/board');
		expect(postMessage).toHaveBeenCalledTimes(1);
	});

	it('tries to register again after a failure', async () => {
		const register = vi
			.fn<() => Promise<unknown>>()
			.mockRejectedValueOnce(new Error('blocked'))
			.mockResolvedValue({});
		const { keep, postMessage } = keeper({ register });
		await expect(keep('https://pit.test/724')).rejects.toThrow('blocked');
		await keep('https://pit.test/724');
		expect(register).toHaveBeenCalledTimes(2);
		expect(postMessage).toHaveBeenCalledTimes(1);
	});

	it('waits quietly when no worker is active yet', async () => {
		const { keep } = keeper({ ready: async () => ({ active: null }) });
		await expect(keep('https://pit.test/724')).resolves.toBeUndefined();
	});
});

describe('withoutHash', () => {
	it('keeps the query and drops the fragment', () => {
		expect(withoutHash('https://pit.test/724/tv?replay=1#x')).toBe(
			'https://pit.test/724/tv?replay=1'
		);
	});
});

describe('usedOffline', () => {
	it('spots pit and workspace use in local storage', () => {
		expect(usedOffline([OFFLINE_KEY])).toBe(true);
		expect(usedOffline(['ps-theme', 'ps-ws:ABC234:meta'])).toBe(true);
		expect(usedOffline(['ps-cache:ABC234:picklist'])).toBe(true);
		expect(usedOffline(['ps-pending:ABC234:board'])).toBe(true);
		expect(usedOffline(['ps-tv-stream'])).toBe(true);
	});

	it('ignores settings every visitor can have', () => {
		expect(usedOffline([])).toBe(false);
		expect(usedOffline(['ps-theme', 'ps-follow', 'ps-hints', 'ps-worker-reset'])).toBe(false);
	});
});

function retire(keys: string[], counts: Record<string, number> = {}, overrides = {}) {
	const unregister = vi.fn(async () => true);
	const remove = vi.fn(async (_key: string) => true);
	const mark = vi.fn();
	const deps: RetireDeps = {
		path: 'events/USMTBUQ',
		used: () => false,
		mark,
		registration: async () => ({ unregister }),
		keys: async () => keys,
		entries: async (key) => counts[key] ?? 0,
		remove,
		...overrides
	};
	return { run: () => retireWorker(deps), unregister, remove, mark };
}

describe('retireWorker', () => {
	it('removes a worker that only ever saw stats pages', async () => {
		const keys = ['pitstop-shell-100', 'pitstop-data-100', 'pitstop-pages-100', 'other'];
		const { run, unregister, remove } = retire(keys);
		expect(await run()).toBe(true);
		expect(unregister).toHaveBeenCalledTimes(1);
		expect(remove.mock.calls.map(([key]) => key)).toEqual(keys.slice(0, 3));
	});

	it('keeps the worker for anyone with saved pit or workspace pages', async () => {
		const { run, unregister, remove, mark } = retire(['pitstop-shell-100', 'pitstop-pages-100'], {
			'pitstop-pages-100': 2
		});
		expect(await run()).toBe(false);
		expect(mark).toHaveBeenCalledTimes(1);
		expect(unregister).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
	});

	it('leaves pit and workspace pages alone', async () => {
		for (const path of ['724', '724/tv', 'w', 'w/ABC234/picklist']) {
			const { run, unregister } = retire(['pitstop-shell-100'], {}, { path });
			expect(await run()).toBe(false);
			expect(unregister).not.toHaveBeenCalled();
		}
	});

	it('leaves the worker when local storage shows offline use', async () => {
		const { run, unregister } = retire(['pitstop-shell-100'], {}, { used: () => true });
		expect(await run()).toBe(false);
		expect(unregister).not.toHaveBeenCalled();
	});

	it('stops if a pit page registered while it was checking', async () => {
		const used = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
		const { run, unregister, remove } = retire(['pitstop-shell-100'], {}, { used });
		expect(await run()).toBe(false);
		expect(unregister).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
	});

	it('does nothing without a registration', async () => {
		const { run, remove } = retire(
			['pitstop-shell-100'],
			{},
			{ registration: async () => undefined }
		);
		expect(await run()).toBe(false);
		expect(remove).not.toHaveBeenCalled();
	});

	it('still clears caches when unregister hangs', async () => {
		const unregister = vi.fn(() => new Promise<boolean>(() => {}));
		const { run, remove } = retire(
			['pitstop-shell-100'],
			{},
			{ registration: async () => ({ unregister }) }
		);
		expect(await run()).toBe(true);
		expect(remove).toHaveBeenCalledWith('pitstop-shell-100');
	});
});
