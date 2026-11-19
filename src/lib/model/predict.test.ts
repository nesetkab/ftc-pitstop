import { describe, expect, it } from 'vitest';
import { COMPONENTS, type Component, type Forecast } from './opr.ts';
import { outcomeChances, predictMatch, redChance, WIN_PARAMS } from './predict.ts';
import { poissonAtLeast } from './stats.ts';

function components(values: Partial<Record<Component, number>>): Record<Component, number> {
	return Object.fromEntries(COMPONENTS.map((c) => [c, values[c] ?? 0])) as Record<
		Component,
		number
	>;
}

function forecast(
	red: number,
	blue: number,
	extra: Partial<Record<Component, number>> = {}
): Forecast {
	return {
		red: { strength: red, score: red + 5, variance: 1.2, components: components(extra) },
		blue: { strength: blue, score: blue + 5, variance: 1.2, components: components({}) },
		marginVariance: 2.4,
		uncertainty: 0.5,
		stats: { mean: 100, sd: 40, parts: COMPONENTS.map(() => 0), matches: 500 }
	};
}

describe('win chance', () => {
	it('is even for equal alliances and symmetric', () => {
		expect(redChance(forecast(60, 60))).toBeCloseTo(0.5, 12);
		expect(redChance(forecast(80, 50)) + redChance(forecast(50, 80))).toBeCloseTo(1, 12);
	});

	it('grows with the margin', () => {
		expect(redChance(forecast(70, 60))).toBeGreaterThan(0.5);
		expect(redChance(forecast(90, 60))).toBeGreaterThan(redChance(forecast(70, 60)));
	});

	it('splits a tie chance off both sides', () => {
		const even = outcomeChances(forecast(60, 60));
		expect(even.tie).toBeCloseTo(WIN_PARAMS.tie, 10);
		expect(even.red + even.blue + even.tie).toBeCloseTo(1, 12);
		const lopsided = outcomeChances(forecast(200, 20));
		expect(lopsided.tie).toBeLessThan(even.tie);
		expect(lopsided.red).toBeGreaterThan(0.9);
	});
});

describe('predictMatch', () => {
	it('adds the opponent fouls to the score and reports a spread', () => {
		const f = forecast(60, 60);
		f.blue.components.fouls = 7;
		const p = predictMatch(f);
		expect(p.red.np).toBe(65);
		expect(p.red.score).toBe(72);
		expect(p.blue.score).toBe(65);
		expect(p.red.sd).toBeGreaterThan(0);
		expect(p.marginSd).toBeGreaterThan(p.red.sd);
	});

	it('sums ranking points from each source', () => {
		const p = predictMatch(forecast(60, 60, { tips: 3 }), { swarm: { red: 0.5, blue: 0.25 } });
		const p1 = poissonAtLeast(4, 3);
		const p2 = poissonAtLeast(7, 3);
		expect(p.red.rp.pollinator1).toBeCloseTo(p1, 10);
		expect(p.red.rp.expected).toBeCloseTo(3 * p.redWin + p.tie + 0.5 + p1 + p2, 10);
		expect(p.blue.rp.swarm).toBe(0.25);
	});
});
