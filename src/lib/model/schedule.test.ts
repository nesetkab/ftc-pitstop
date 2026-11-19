import { describe, expect, it } from 'vitest';
import {
	estimateStarts,
	observedCycle,
	PLAYOFF_SCHEDULE,
	scheduledCycle,
	type TimedMatch
} from './schedule.ts';

const MIN = 60_000;

function plan(times: number[], actual: (number | null)[] = []): TimedMatch[] {
	return times.map((t, i) => ({
		key: `q${i + 1}`,
		scheduled: t * MIN,
		actual: actual[i] === undefined || actual[i] === null ? null : actual[i]! * MIN
	}));
}

const minutes = (xs: { start: number }[]) => xs.map((x) => x.start / MIN);

describe('estimateStarts', () => {
	it('keeps the schedule before anything is played', () => {
		const est = estimateStarts(plan([0, 7, 14, 21]));
		expect(minutes(est)).toEqual([0, 7, 14, 21]);
		expect(est[2].queue).toBe(0);
		expect(est[0].queue).toBe(-14 * MIN);
		expect(est.every((e) => !e.played)).toBe(true);
	});

	it('carries a delay forward at the observed pace', () => {
		const est = estimateStarts(plan([0, 7, 14, 21, 28, 35], [10, 17, 24]));
		expect(minutes(est)).toEqual([10, 17, 24, 31, 38, 45]);
		expect(est[4].delay).toBe(10 * MIN);
		expect(est[5].queue).toBe(est[3].start);
		expect(est[2].played).toBe(true);
	});

	it('blends a faster observed cycle with the planned gaps', () => {
		const est = estimateStarts(plan([0, 7, 14, 21, 28], [0, 5, 10]));
		expect(observedCycle(plan([0, 7, 14], [0, 5, 10]))).toBe(5 * MIN);
		expect(minutes(est).slice(3)).toEqual([16, 22]);
	});

	it('absorbs a delay over a scheduled break', () => {
		const est = estimateStarts(plan([0, 7, 14, 74, 81], [5, 12, 19]));
		expect(minutes(est).slice(3)).toEqual([74, 81]);
		const late = estimateStarts(plan([0, 7, 14, 24, 31], [30, 37, 44]));
		expect(minutes(late)[3]).toBe(51);
	});

	it('never starts before now', () => {
		const est = estimateStarts(plan([0, 7, 14, 21], [0, 7]), { now: 20 * MIN });
		expect(minutes(est).slice(2)).toEqual([20, 27]);
	});

	it('does not start playoff matches early', () => {
		const est = estimateStarts(plan([0, 6, 12, 30], [0, 3]), PLAYOFF_SCHEDULE);
		expect(est[2].start).toBeGreaterThanOrEqual(12 * MIN);
		expect(est[3].start).toBeGreaterThanOrEqual(30 * MIN);
	});

	it('steps past matches without a scheduled time', () => {
		const est = estimateStarts([
			...plan([0, 7], [0, 7]),
			{ key: 'x', scheduled: null, actual: null }
		]);
		expect(est[2].start).toBe(14 * MIN);
		expect(est[2].delay).toBeNull();
		expect(scheduledCycle([])).toBeNull();
	});
});
