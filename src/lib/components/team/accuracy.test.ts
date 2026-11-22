import { describe, expect, it } from 'vitest';
import sample from './accuracy-sample.json';
import {
	baseRateBrier,
	isAccuracyReport,
	prepareReport,
	seasonRange,
	splitNote,
	type AccuracyReport
} from './accuracy.ts';

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
		expect(splitNote('validation')).toBe('Used to set parameters and choose the model');
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

describe('prepareReport', () => {
	function report(): AccuracyReport {
		const value: unknown = structuredClone(sample);
		if (!isAccuracyReport(value)) throw new Error('The sample file is not a valid report');
		return value;
	}

	it('keeps only what the page shows', () => {
		const extra = {
			...report(),
			pooled: { train: {} },
			validationGap: { diff: 0 },
			method: { ...report().method, primary: 'brier' }
		};
		const trimmed = prepareReport(extra);
		expect(Object.keys(trimmed).sort()).toEqual([
			'calibration',
			'chosen',
			'generatedAt',
			'method',
			'models',
			'rp',
			'schedule',
			'seasons'
		]);
		expect(Object.keys(trimmed.method).sort()).toEqual(['test', 'train', 'validation']);
	});

	it('drops a model that gives the same numbers as the chosen one in every season', () => {
		const base = report();
		const twin = {
			...base,
			models: [...base.models, { id: 'blend', label: 'Blend: 100% opr-map' }],
			seasons: base.seasons.map((season) => ({
				...season,
				models: { ...season.models, blend: season.models[base.chosen.id] }
			}))
		};
		const trimmed = prepareReport(twin);
		expect(trimmed.models.map((model) => model.id)).toEqual(['opr-event', 'opr-map', 'epa']);
		expect(Object.keys(trimmed.seasons[0].models)).toEqual(['opr-event', 'opr-map', 'epa']);
	});

	it('keeps a model that differs in any season', () => {
		const base = report();
		const near = {
			...base,
			models: [...base.models, { id: 'near', label: 'Near' }],
			seasons: base.seasons.map((season, index) => ({
				...season,
				models: {
					...season.models,
					near: {
						...season.models[base.chosen.id],
						brier: index === 0 ? 0.5 : season.models[base.chosen.id].brier
					}
				}
			}))
		};
		expect(prepareReport(near).models.map((model) => model.id)).toContain('near');
	});

	it('leaves out sections the report does not have', () => {
		const { calibration, rp, schedule, ...rest } = report();
		void calibration;
		void rp;
		void schedule;
		const trimmed = prepareReport(rest);
		expect(trimmed.calibration).toBeUndefined();
		expect(trimmed.rp).toBeUndefined();
		expect(trimmed.schedule).toBeUndefined();
	});
});
