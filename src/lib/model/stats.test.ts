import { describe, expect, it } from 'vitest';
import {
	countPmf,
	mulberry32,
	negBinAtLeast,
	normalCdf,
	normalQuantile,
	normalSampler,
	poissonAtLeast,
	poissonPmf
} from './stats.ts';

describe('normal distribution', () => {
	it('matches known values', () => {
		expect(normalCdf(0)).toBeCloseTo(0.5, 7);
		expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6);
		expect(normalCdf(-1)).toBeCloseTo(0.158655, 6);
	});

	it('inverts the cdf', () => {
		for (const p of [0.001, 0.02, 0.3, 0.5, 0.8, 0.99])
			expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 6);
	});
});

describe('count distributions', () => {
	it('computes Poisson tails by hand', () => {
		const below4 = Math.exp(-4) * (1 + 4 + 8 + 32 / 3);
		expect(poissonAtLeast(4, 4)).toBeCloseTo(1 - below4, 10);
		expect(poissonAtLeast(0, 2)).toBe(1);
		expect(poissonAtLeast(3, 0)).toBe(0);
		expect(poissonPmf(2, 3)).toBeCloseTo((9 / 2) * Math.exp(-3), 12);
	});

	it('approaches Poisson as the negative binomial size grows', () => {
		expect(negBinAtLeast(4, 2.5, 1e7)).toBeCloseTo(poissonAtLeast(4, 2.5), 5);
		expect(negBinAtLeast(4, 2.5, Infinity)).toBe(poissonAtLeast(4, 2.5));
		expect(negBinAtLeast(4, 2.5, 2)).toBeGreaterThan(poissonAtLeast(4, 2.5));
	});

	it('builds pmfs that sum to one', () => {
		for (const size of [Infinity, 3]) {
			const pmf = countPmf(1.7, size, 24);
			expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
		}
		expect(Array.from(countPmf(0, Infinity, 5))).toEqual([1, 0, 0, 0, 0, 0]);
	});
});

describe('random numbers', () => {
	it('is reproducible for a seed', () => {
		const a = mulberry32(42);
		const b = mulberry32(42);
		const xs = Array.from({ length: 5 }, a);
		expect(Array.from({ length: 5 }, b)).toEqual(xs);
		expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
	});

	it('draws standard normals', () => {
		const draw = normalSampler(mulberry32(3));
		const xs = Array.from({ length: 20000 }, draw);
		const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
		const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
		expect(Math.abs(mean)).toBeLessThan(0.03);
		expect(variance).toBeCloseTo(1, 1);
	});
});
