import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CHOICE, sortBy, toggleColumn } from './ranking-columns.ts';
import { loadRankingChoice, saveRankingChoice } from './ranking-store.ts';

function fakeStorage(items = new Map<string, string>()) {
	return {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value),
		removeItem: (key: string) => void items.delete(key)
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('ranking store', () => {
	it('remembers the last choice', () => {
		vi.stubGlobal('localStorage', fakeStorage());
		const choice = sortBy(toggleColumn(DEFAULT_CHOICE, 'opr-auto', true), 'opr-auto');
		expect(saveRankingChoice(choice)).toBe(true);
		expect(loadRankingChoice()).toEqual(choice);
	});

	it('forgets the choice once it is back to the default', () => {
		const items = new Map([['ps-rankings-view', 'sort=opr']]);
		vi.stubGlobal('localStorage', fakeStorage(items));
		saveRankingChoice(DEFAULT_CHOICE);
		expect(items.size).toBe(0);
		expect(loadRankingChoice()).toBeNull();
	});

	it('copes without storage', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
			removeItem: () => {
				throw new Error('blocked');
			}
		});
		expect(loadRankingChoice()).toBeNull();
		expect(saveRankingChoice(sortBy(DEFAULT_CHOICE, 'opr'))).toBe(false);
	});
});
