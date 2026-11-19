import { describe, expect, it } from 'vitest';
import {
	COMPONENTS,
	OPR_PARAMS,
	orderMatches,
	priorFor,
	rateSeason,
	type OprParams
} from './opr.ts';
import type { ModelEvent, ModelMatch } from './types.ts';

const FLAT: OprParams = {
	...OPR_PARAMS,
	lamNew: 1e-9,
	lamReturning: 1e-9,
	carry: 1,
	drift: 0,
	q: 0,
	qWeek: 0
};

let n = 0;
function match(
	red: number[],
	blue: number[],
	redNp: number | null,
	blueNp: number | null,
	extra: Partial<ModelMatch> = {}
): ModelMatch {
	n++;
	return {
		key: `q${n}`,
		eventCode: 'TEST',
		level: 'qual',
		number: n,
		time: n,
		red,
		blue,
		redScore: redNp,
		blueScore: blueNp,
		redNp,
		blueNp,
		...extra
	};
}

function event(code: string, start: string, matches: ModelMatch[]): ModelEvent {
	return { code, start, matches: matches.map((m) => ({ ...m, eventCode: code })) };
}

describe('rateSeason', () => {
	it('recovers least squares OPR when the prior is flat', () => {
		const result = rateSeason(
			[
				event('A', '2026-10-01', [
					match([1, 2], [3, 4], 30, 70),
					match([1, 3], [2, 4], 40, 60),
					match([1, 4], [2, 3], 50, 50)
				])
			],
			{ params: FLAT }
		);
		const ratings = new Map(result.events.get('A')!.ratings.map((r) => [r.team, r]));
		expect(ratings.get(1)!.opr).toBeCloseTo(10, 4);
		expect(ratings.get(2)!.opr).toBeCloseTo(20, 4);
		expect(ratings.get(3)!.opr).toBeCloseTo(30, 4);
		expect(ratings.get(4)!.opr).toBeCloseTo(40, 4);
		expect(ratings.get(4)!.strength).toBeCloseTo(40, 4);
		expect(ratings.get(1)!.matches).toBe(3);
	});

	it('shrinks toward the prior with a strong prior', () => {
		const strong: OprParams = { ...OPR_PARAMS, lamNew: 1e6, rhoNewScore: 1 };
		const result = rateSeason(
			[event('A', '2026-10-01', [match([1, 2], [3, 4], 10, 90), match([1, 3], [2, 4], 50, 50)])],
			{
				params: strong
			}
		);
		const r = new Map(result.events.get('A')!.ratings.map((x) => [x.team, x.opr]));
		const spread = Math.max(...r.values()) - Math.min(...r.values());
		expect(spread).toBeLessThan(0.01);
	});

	it('credits only present teams when a team does not show', () => {
		const result = rateSeason(
			[event('A', '2026-10-01', [match([1, 2], [3, 4], 12, 50, { noShows: [2] })])],
			{
				params: FLAT
			}
		);
		const ev = result.events.get('A')!;
		const teams = ev.ratings.map((r) => r.team).sort();
		expect(teams).toEqual([1, 3, 4]);
		expect(ev.rater.value(1)).toBeCloseTo(12, 4);
		expect(ev.rater.matchesPlayed(2)).toBe(0);
	});

	it('skips a disqualified playoff alliance', () => {
		const m = match([1, 2], [3, 4], 0, 80, { level: 'playoff', dqs: [1] });
		const result = rateSeason([event('A', '2026-10-01', [match([1, 3], [2, 4], 40, 60), m])], {
			params: FLAT
		});
		const rater = result.events.get('A')!.rater;
		expect(rater.value(3) + rater.value(4)).toBeCloseTo(80, 4);
		expect(rater.value(1) + rater.value(2)).toBeCloseTo(20, 4);
	});

	it('keeps surrogate matches in the rating', () => {
		const result = rateSeason(
			[event('A', '2026-10-01', [match([1, 2], [3, 4], 30, 70, { surrogates: [1] })])],
			{
				params: FLAT
			}
		);
		expect(result.events.get('A')!.rater.matchesPlayed(1)).toBe(1);
	});

	it('carries ratings into the next event as priors', () => {
		const first = event('A', '2026-10-01', [
			match([1, 2], [3, 4], 30, 70),
			match([1, 3], [2, 4], 40, 60),
			match([1, 4], [2, 3], 50, 50)
		]);
		const second = event('B', '2026-10-15', [match([1, 4], [2, 3], null, null)]);
		const result = rateSeason([second, first], { params: FLAT });
		const rater = result.events.get('B')!.rater;
		expect(rater.value(1)).toBeCloseTo(10, 3);
		expect(rater.value(4)).toBeCloseTo(40, 3);
		expect(result.events.get('B')!.steps).toHaveLength(0);
		const f = rater.forecast([1, 4], [2, 3]);
		expect(f.red.score).toBeCloseTo(50, 3);
		expect(f.marginVariance).toBeGreaterThan(2);
		expect(result.latest.get(2)!.opr).toBeCloseTo(20, 3);
	});

	it('uses last season through the relative prior', () => {
		const priors = { params: OPR_PARAMS, states: new Map(), previous: new Map([[1, 2]]) };
		const stats = { mean: 100, sd: 30, parts: COMPONENTS.map(() => 0), matches: 10 };
		const returning = priorFor(1, priors, stats, 0);
		const rookie = priorFor(2, priors, stats, 0);
		expect(returning.values[0]).toBeCloseTo(50 * (OPR_PARAMS.rhoReturning + OPR_PARAMS.beta), 10);
		expect(returning.values[1]).toBeCloseTo(
			50 * (OPR_PARAMS.rhoReturningScore + OPR_PARAMS.beta),
			10
		);
		expect(rookie.values[0]).toBeCloseTo(50 * OPR_PARAMS.rhoNew, 10);
		expect(rookie.values[1]).toBeCloseTo(50 * OPR_PARAMS.rhoNewScore, 10);
		expect(returning.prec).toBe(OPR_PARAMS.lamReturning);
		expect(rookie.prec).toBe(OPR_PARAMS.lamNew);
	});

	it('records ratings before and after every match', () => {
		const result = rateSeason([
			event('A', '2026-10-01', [match([1, 2], [3, 4], 30, 70), match([1, 3], [2, 4], 40, 60)])
		]);
		const steps = result.events.get('A')!.steps;
		expect(steps).toHaveLength(2);
		expect(steps[0].ratings.map((r) => r.team)).toEqual([1, 2, 3, 4]);
		expect(steps[1].ratings[0].before).toBeCloseTo(steps[0].ratings[0].after, 10);
		expect(steps[0].forecast.red.score).toBe(steps[0].forecast.blue.score);
	});

	it('keeps components consistent with the total', () => {
		const detail = (auto: number, teleop: number, tips: number) => ({
			autoPoints: auto,
			teleopPoints: teleop,
			tips
		});
		const result = rateSeason([
			event('A', '2026-10-01', [
				match([1, 2], [3, 4], 30, 70, {
					redDetail: detail(10, 20, 1),
					blueDetail: detail(30, 40, 3)
				}),
				match([1, 3], [2, 4], 40, 60, {
					redDetail: detail(15, 25, 2),
					blueDetail: detail(20, 40, 2)
				})
			])
		]);
		for (const r of result.events.get('A')!.ratings) {
			expect(r.components.auto + r.components.teleop).toBeCloseTo(r.opr, 6);
			expect(r.components.tips).toBeGreaterThan(0);
		}
	});

	it('handles a season with no matches', () => {
		const result = rateSeason([]);
		expect(result.events.size).toBe(0);
		expect(result.stats.matches).toBe(0);
	});
});

describe('orderMatches', () => {
	it('puts quals by number before playoffs by time', () => {
		const q2 = match([1], [2], 1, 1, { number: 2, time: 50 });
		const q1 = match([1], [2], 1, 1, { number: 1, time: 60 });
		const p1 = match([1], [2], 1, 1, { level: 'playoff', time: 10 });
		expect(orderMatches([p1, q2, q1])).toEqual([q1, q2, p1]);
	});
});
