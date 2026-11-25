import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	clearRecent,
	parseRecent,
	readRecent,
	RECENT_KEY,
	RECENT_LIMIT,
	rememberRecent,
	withRecent
} from './recent-searches.ts';
import type { SearchResult } from './search.svelte.ts';

function team(number: number): SearchResult {
	return {
		type: 'team',
		label: `${number} Team`,
		sublabel: 'Gilbert, Arizona',
		href: `/teams/${number}`
	};
}

const store = new Map<string, string>();

vi.stubGlobal('localStorage', {
	getItem: (key: string) => store.get(key) ?? null,
	setItem: (key: string, value: string) => store.set(key, value),
	removeItem: (key: string) => store.delete(key)
});

afterEach(() => store.clear());

describe('recent searches', () => {
	it('puts the newest first, drops repeats and keeps a short list', () => {
		let list: SearchResult[] = [];
		for (let number = 1; number <= RECENT_LIMIT + 2; number++)
			list = withRecent(list, team(number));
		list = withRecent(list, team(5));
		expect(list.map((entry) => entry.href)).toEqual([
			'/teams/5',
			'/teams/8',
			'/teams/7',
			'/teams/6',
			'/teams/4',
			'/teams/3'
		]);
	});

	it('stores only what it needs and leaves out live details', () => {
		rememberRecent({ ...team(1), meta: '85.2 OPR · #12', live: true });
		expect(JSON.parse(store.get(RECENT_KEY) ?? '[]')).toEqual([
			{ type: 'team', label: '1 Team', sublabel: 'Gilbert, Arizona', href: '/teams/1' }
		]);
		expect(readRecent()).toHaveLength(1);
	});

	it('keeps the place or dates but not a live day count', () => {
		rememberRecent({ ...team(1), aside: 'Gilbert, Arizona' });
		rememberRecent({
			type: 'event',
			label: 'Butte',
			aside: 'Day 2 of 2',
			live: true,
			href: '/events/USMTBUQ'
		});
		expect(readRecent()).toEqual([
			{ type: 'event', label: 'Butte', sublabel: null, href: '/events/USMTBUQ' },
			{ ...team(1), aside: 'Gilbert, Arizona' }
		]);
	});

	it('ignores broken or foreign entries', () => {
		expect(parseRecent('not json')).toEqual([]);
		expect(parseRecent('{"a":1}')).toEqual([]);
		expect(
			parseRecent(
				JSON.stringify([team(1), { type: 'team', label: 'x', href: 'https://evil.test' }])
			)
		).toEqual([team(1)]);
	});

	it('clears the list', () => {
		rememberRecent(team(1));
		expect(clearRecent()).toEqual([]);
		expect(store.has(RECENT_KEY)).toBe(false);
	});

	it('keeps working when storage is blocked', () => {
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
		expect(readRecent()).toEqual([]);
		expect(rememberRecent(team(1))).toEqual([team(1)]);
		expect(clearRecent()).toEqual([]);
	});
});
