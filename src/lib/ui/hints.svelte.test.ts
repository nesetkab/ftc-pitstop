import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	dismissHint,
	eventThisWeek,
	HINTS_KEY,
	parseHints,
	readHints,
	showIntro
} from './hints.ts';

beforeEach(() => localStorage.clear());

afterEach(() => vi.restoreAllMocks());

describe('parseHints', () => {
	it('keeps only known hint ids, once each', () => {
		expect(parseHints('["intro","pit","intro","other",3]')).toEqual(['intro', 'pit']);
	});

	it('treats missing or damaged values as nothing dismissed', () => {
		expect(parseHints(null)).toEqual([]);
		expect(parseHints('{')).toEqual([]);
		expect(parseHints('{"intro":true}')).toEqual([]);
	});
});

describe('dismissHint', () => {
	it('remembers dismissed hints across reads', () => {
		dismissHint('pit');
		dismissHint('intro');
		dismissHint('pit');
		expect(readHints()).toEqual(['pit', 'intro']);
		expect(localStorage.getItem(HINTS_KEY)).toBe('["pit","intro"]');
	});

	it('still hides the hint for this visit when storage is blocked', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(dismissHint('intro')).toEqual(['intro']);
		expect(readHints()).toEqual([]);
	});

	it('reads nothing when storage cannot be read', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(readHints()).toEqual([]);
	});
});

describe('showIntro', () => {
	it('shows only to visitors who follow no team and have not hidden it', () => {
		expect(showIntro([], [])).toBe(true);
		expect(showIntro(['pit'], [])).toBe(true);
		expect(showIntro(['intro'], [])).toBe(false);
		expect(showIntro([], [26670])).toBe(false);
	});
});

describe('eventThisWeek', () => {
	const now = Date.parse('2026-11-23T18:00:00Z');
	const row = (start: string, end: string, live = false) => ({ start, end, live });

	it('picks an event that is on now or starts within a week', () => {
		expect(eventThisWeek([row('2026-11-23', '2026-11-23', true)], now)).toEqual(
			row('2026-11-23', '2026-11-23', true)
		);
		expect(eventThisWeek([row('2026-11-28', '2026-11-29')], now)).toEqual(
			row('2026-11-28', '2026-11-29')
		);
	});

	it('ignores events more than a week out or already over', () => {
		expect(eventThisWeek([row('2026-12-11', '2026-12-13')], now)).toBeNull();
		expect(eventThisWeek([row('2026-11-14', '2026-11-14')], now)).toBeNull();
		expect(eventThisWeek([], now)).toBeNull();
	});
});
