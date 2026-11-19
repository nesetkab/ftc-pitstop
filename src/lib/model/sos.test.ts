import { describe, expect, it } from 'vitest';
import { scheduleStrength } from './sos.ts';
import type { ModelMatch } from './types.ts';

function m(
	red: number[],
	blue: number[],
	r: number,
	b: number,
	surrogates: number[] = []
): ModelMatch {
	return {
		key: 'q',
		eventCode: 'T',
		level: 'qual',
		time: 0,
		red,
		blue,
		redScore: r,
		blueScore: b,
		redNp: r,
		blueNp: b,
		surrogates
	};
}

describe('scheduleStrength', () => {
	const rating = (t: number) => ({ 1: 10, 2: 20, 3: 30, 4: 40 })[t] ?? 0;

	it('averages partners and opponents and compares RS with expectation', () => {
		const out = scheduleStrength({
			matches: [m([1, 2], [3, 4], 50, 40), m([1, 3], [2, 4], 30, 60)],
			rating,
			expectedRp: () => ({ red: 1.5, blue: 2.5 })
		});
		const one = out.find((s) => s.team === 1)!;
		expect(one.matches).toBe(2);
		expect(one.partner).toBe(25);
		expect(one.opponent).toBe(32.5);
		expect(one.partnerVsField).toBe(0);
		expect(one.expectedRs).toBe(1.5);
		expect(one.actualRs).toBe(1.5);
		expect(one.luck).toBe(0);
		const four = out.find((s) => s.team === 4)!;
		expect(four.expectedRs).toBe(2.5);
		expect(four.actualRs).toBe(1.5);
		expect(four.luck).toBe(-1);
	});

	it('skips surrogate and unplayed matches and teams with none', () => {
		const out = scheduleStrength({
			matches: [
				m([1, 2], [3, 4], 50, 40, [1]),
				{ ...m([1, 2], [3, 4], 0, 0), redScore: null, blueScore: null }
			],
			rating,
			expectedRp: () => ({ red: 2, blue: 2 })
		});
		expect(out.map((s) => s.team)).toEqual([2, 3, 4]);
		expect(
			scheduleStrength({ matches: [], rating, expectedRp: () => ({ red: 0, blue: 0 }) })
		).toEqual([]);
	});
});
