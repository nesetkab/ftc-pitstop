import { describe, expect, it } from 'vitest';
import sample from './accuracy-sample.json';
import { baseRateBrier, isAccuracyReport, seasonRange, splitNote } from './accuracy.ts';

describe('isAccuracyReport', () => {
	it('accepts the sample file', () => {
		expect(isAccuracyReport(sample)).toBe(true);
	});

	it('rejects anything that is missing the parts the page needs', () => {
		expect(isAccuracyReport(null)).toBe(false);
		expect(isAccuracyReport({})).toBe(false);
		expect(isAccuracyReport({ ...sample, seasons: [] })).toBe(false);
		expect(isAccuracyReport({ ...sample, models: 'none' })).toBe(false);
		expect(isAccuracyReport({ ...sample, chosen: {} })).toBe(false);
	});
});

describe('seasonRange', () => {
	it('writes seasons the way the page needs them', () => {
		expect(seasonRange([2021, 2022, 2023])).toBe('2021 to 2023');
		expect(seasonRange([2024, 2025])).toBe('2024 and 2025');
		expect(seasonRange([2026])).toBe('2026');
		expect(seasonRange([2021, 2023, 2025])).toBe('2021, 2023 and 2025');
		expect(seasonRange([])).toBe('');
	});
});

describe('splitNote', () => {
	it('explains what each split was used for', () => {
		expect(splitNote('train')).toBe('Used to set parameters');
		expect(splitNote('validation')).toBe('Used to choose the model');
		expect(splitNote('test')).toBe('Not used for tuning');
		expect(splitNote('other')).toBe('');
	});
});

describe('baseRateBrier', () => {
	it('is the Brier score of always predicting the base rate', () => {
		expect(baseRateBrier(0.5)).toBe(0.25);
		expect(baseRateBrier(0.6284)).toBeCloseTo(0.2335, 4);
		expect(baseRateBrier(0)).toBe(0);
	});
});
