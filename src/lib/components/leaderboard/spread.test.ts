import { describe, expect, it } from 'vitest';
import { oprSpread, spreadBin } from './spread.ts';

describe('oprSpread', () => {
	it('needs enough teams to draw', () => {
		expect(oprSpread([1, 2, 3])).toBeNull();
	});

	it('counts every team once in even bins', () => {
		const values = Array.from({ length: 100 }, (_, index) => index);
		const spread = oprSpread(values, 10);
		expect(spread).not.toBeNull();
		expect(spread!.step).toBe(10);
		expect(spread!.start).toBe(0);
		expect(spread!.counts).toEqual(Array.from({ length: 10 }, () => 10));
	});

	it('covers negative ratings and the top value', () => {
		const values = [-3.2, -1, 0, 4, 8, 12, 15, 19.9, 22, 40.5];
		const spread = oprSpread(values, 8)!;
		expect(spread.start).toBeLessThanOrEqual(-3.2);
		expect(spread.start + spread.step * spread.counts.length).toBeGreaterThan(40.5);
		expect(spread.counts.reduce((sum, count) => sum + count, 0)).toBe(values.length);
	});

	it('handles teams that all share one rating', () => {
		const spread = oprSpread(Array.from({ length: 12 }, () => 5))!;
		expect(spread.counts.reduce((sum, count) => sum + count, 0)).toBe(12);
		expect(spread.counts[spreadBin(spread, 5)]).toBe(12);
	});

	it('finds the bin for a value', () => {
		const spread = oprSpread(
			Array.from({ length: 100 }, (_, index) => index),
			10
		)!;
		expect(spreadBin(spread, 0)).toBe(0);
		expect(spreadBin(spread, 55)).toBe(5);
		expect(spreadBin(spread, 99)).toBe(9);
		expect(spreadBin(spread, 500)).toBe(9);
	});
});
