import { describe, expect, it } from 'vitest';
import { plausibleMatch, plausibleScore, rated, type ModelMatch } from './types.ts';

function game(
	red: number | null,
	blue: number | null,
	extra: Partial<ModelMatch> = {}
): ModelMatch {
	return {
		key: 'q1',
		eventCode: 'TEST',
		level: 'qual',
		time: 0,
		red: [1, 2],
		blue: [3, 4],
		redScore: red,
		blueScore: blue,
		redNp: red,
		blueNp: blue,
		...extra
	};
}

describe('plausible scores', () => {
	it('rejects totals above the cap and parts that do not add up', () => {
		expect(plausibleScore(250, 240, 60, 180)).toBe(true);
		expect(plausibleScore(601, 240)).toBe(false);
		expect(plausibleScore(250, 240, 60, 100)).toBe(false);
		expect(plausibleScore(250, 240)).toBe(true);
	});

	it('only rates played matches with believable scores', () => {
		expect(rated(game(80, 120))).toBe(true);
		expect(rated(game(7308, 8355))).toBe(false);
		expect(rated(game(null, null))).toBe(false);
		expect(plausibleMatch(game(null, null))).toBe(true);
		const broken = game(80, 120, { redDetail: { autoPoints: 10, teleopPoints: 10 } });
		expect(plausibleMatch(broken)).toBe(false);
	});
});
