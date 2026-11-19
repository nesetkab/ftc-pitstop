import { describe, expect, it } from 'vitest';
import { labelEvery, linearScale, niceStep, niceTicks } from './chart.ts';

describe('linearScale', () => {
	it('maps a domain onto a range', () => {
		const y = linearScale([0, 60], [172, 24]);
		expect(y(0)).toBe(172);
		expect(y(60)).toBe(24);
		expect(y(30)).toBe(98);
	});

	it('returns the middle of the range for an empty domain', () => {
		expect(linearScale([5, 5], [0, 100])(5)).toBe(50);
	});
});

describe('niceTicks', () => {
	it('rounds the top up to a clean step', () => {
		expect(niceTicks(0, 55.1)).toEqual([0, 20, 40, 60]);
		expect(niceTicks(0, 49.6)).toEqual([0, 20, 40, 60]);
		expect(niceTicks(0, 178)).toEqual([0, 50, 100, 150, 200]);
	});

	it('covers negative values', () => {
		expect(niceTicks(-11.2, 15.2)).toEqual([-20, -10, 0, 10, 20]);
	});

	it('handles flat data', () => {
		expect(niceTicks(0, 0)).toEqual([0, 1]);
	});

	it('picks 1, 2, 2.5, 5 or 10 times a power of ten', () => {
		expect(niceStep(1, 4)).toBe(0.25);
		expect(niceStep(7, 4)).toBe(2);
		expect(niceStep(35, 4)).toBe(10);
	});
});

describe('labelEvery', () => {
	it('thins labels that would collide', () => {
		expect(labelEvery(10, 60)).toBe(1);
		expect(labelEvery(40, 12)).toBe(3);
		expect(labelEvery(1, 0)).toBe(1);
	});
});
