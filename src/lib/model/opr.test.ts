import { describe, expect, it } from 'vitest';
import previousSeason from './previous-2025.json';
import {
	blendPrevious,
	COMPONENTS,
	OPR_PARAMS,
	orderMatches,
	packPrevious,
	previousFrom,
	priorFor,
	rateSeason,
	ROBOT_BASE,
	softFloor,
	type OprParams,
	type PriorRel
} from './opr.ts';
import type { ModelEvent, ModelMatch } from './types.ts';

const FLAT: OprParams = {
	...OPR_PARAMS,
	rest: {
		...OPR_PARAMS.rest,
		lamNew: 1e-9,
		lamReturning: 1e-9,
		carry: 1,
		drift: 0,
		q: 0,
		qWeek: 0
	},
	robot: { ...OPR_PARAMS.robot, lamNew: 1e9, rhoNew: 0, rhoNewScore: 0, carry: 1, q: 0, qWeek: 0 },
	parts: { ...OPR_PARAMS.parts, scoreCommon: 0, scoreQ: 0 },
	het: 0,
	imbFit: 0,
	imbPred: 0,
	floor: -100
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

const robots = (red: number[], blue: number[]): Partial<ModelMatch> => ({
	redDetail: { robotSwarm: red },
	blueDetail: { robotSwarm: blue }
});

describe('rateSeason', () => {
	it('recovers least squares OPR when the prior is flat and the extras are off', () => {
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

	it('credits each robot with the points it scored itself', () => {
		const games = [
			match([1, 2], [3, 4], 40, 40, robots([12, 0], [6, 6])),
			match([1, 2], [3, 4], 40, 40, robots([12, 0], [6, 6])),
			match([1, 2], [3, 4], 40, 40, robots([12, 0], [6, 6]))
		];
		const plain = games.map(({ redDetail: _r, blueDetail: _b, ...m }) => ({
			...m,
			key: `${m.key}x`
		}));
		const rater = rateSeason([event('A', '2026-10-01', games)]).events.get('A')!.rater;
		const blind = rateSeason([event('A', '2026-10-01', plain)]).events.get('A')!.rater;
		expect(rater.value(1)).toBeGreaterThan(rater.value(2) + 3);
		expect(blind.value(1)).toBeCloseTo(blind.value(2), 6);
	});

	it('still rates matches with no per-robot detail', () => {
		const result = rateSeason([
			event('A', '2026-10-01', [
				match([1, 2], [3, 4], 30, 70),
				match([1, 3], [2, 4], 40, 60, robots([5, 8], [3, 0]))
			])
		]);
		const ratings = result.events.get('A')!.ratings;
		expect(ratings).toHaveLength(4);
		for (const r of ratings) expect(Number.isFinite(r.opr)).toBe(true);
		expect(result.stats.robot).toBeGreaterThan(0);
	});

	it('ignores robot points that add up to more than the alliance scored', () => {
		const clean = [match([1, 2], [3, 4], 30, 70)];
		const bad = [match([1, 2], [3, 4], 30, 70, robots([40, 40], [90, 1]))];
		const a = rateSeason([event('A', '2026-10-01', clean)]).events.get('A')!.rater;
		const b = rateSeason([event('A', '2026-10-01', bad)]).events.get('A')!.rater;
		expect(b.value(1)).toBeCloseTo(a.value(1), 10);
	});

	it('keeps every team above zero', () => {
		const games = [
			match([1, 2], [3, 4], 10, 60),
			match([1, 3], [2, 4], 60, 20),
			match([2, 3], [1, 4], 40, 70),
			match([1, 2], [3, 4], 5, 60)
		];
		const ratings = rateSeason([event('A', '2026-10-01', games)]).events.get('A')!.ratings;
		for (const r of ratings) {
			expect(r.opr).toBeGreaterThan(0);
			expect(r.strength).toBeGreaterThan(0);
		}
	});

	it('adds a bonus when one partner is much stronger', () => {
		const games = [
			match([1, 2], [3, 4], 90, 40),
			match([1, 3], [2, 4], 80, 30),
			match([1, 4], [2, 3], 85, 35)
		];
		const rater = rateSeason([event('A', '2026-10-01', games)]).events.get('A')!.rater;
		const f = rater.forecast([1, 2], [3, 4]);
		expect(f.red.strength).toBeGreaterThan(rater.value(1, 'strength') + rater.value(2, 'strength'));
		expect(f.red.score).toBeGreaterThan(rater.value(1) + rater.value(2));
	});

	it('credits only present teams when a team does not show', () => {
		const result = rateSeason(
			[event('A', '2026-10-01', [match([1, 2], [3, 4], 12, 50, { noShows: [2] })])],
			{ params: FLAT }
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
			{ params: FLAT }
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
		expect(result.relative.get(4)![0] / result.relative.get(1)![0]).toBeCloseTo(4, 3);
	});

	it('uses earlier seasons through the relative prior', () => {
		const priors = {
			params: OPR_PARAMS,
			states: new Map(),
			previous: new Map<number, PriorRel>([[1, [2, 3]]])
		};
		const stats = { mean: 100, sd: 30, robot: 20, parts: COMPONENTS.map(() => 10), matches: 10 };
		const returning = priorFor(1, priors, stats, 0);
		const rookie = priorFor(2, priors, stats, 0);
		const { rest, robot } = OPR_PARAMS;
		expect(returning.rest.mu).toBeCloseTo(40 * (rest.rhoReturning + rest.beta), 10);
		expect(returning.rest.nu).toBeCloseTo(40 * (rest.rhoReturningScore + rest.beta), 10);
		expect(returning.robot.mu).toBeCloseTo(10 * (robot.rhoReturning + 2 * robot.beta), 10);
		expect(rookie.rest.mu).toBeCloseTo(40 * rest.rhoNew, 10);
		expect(rookie.robot.nu).toBeCloseTo(10 * robot.rhoNewScore, 10);
		expect(returning.rest.prec).toBe(rest.lamReturning);
		expect(rookie.robot.prec).toBe(robot.lamNew);
		expect(returning.parts[0]).toBeGreaterThan(rookie.parts[0]);
	});

	it('records ratings before and after every match', () => {
		const result = rateSeason([
			event('A', '2026-10-01', [match([1, 2], [3, 4], 30, 70), match([1, 3], [2, 4], 40, 60)])
		]);
		const steps = result.events.get('A')!.steps;
		expect(steps).toHaveLength(2);
		expect(steps[0].ratings.map((r) => r.team)).toEqual([1, 2, 3, 4]);
		expect(steps[1].ratings[0].before).toBeGreaterThan(0);
		expect(steps[0].forecast.red.score).toBe(steps[0].forecast.blue.score);
	});

	it('learns scoring parts from the match detail', () => {
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
		const ratings = new Map(result.events.get('A')!.ratings.map((r) => [r.team, r]));
		for (const r of ratings.values()) expect(r.components.tips).toBeGreaterThan(0);
		expect(ratings.get(4)!.components.auto).toBeGreaterThan(ratings.get(1)!.components.auto);
	});

	it('spreads an event-wide scoring shift to parts but not to win strength', () => {
		const detail = { autoPoints: 60 };
		const games = [
			match([1, 2], [3, 4], 120, 120, { redDetail: detail, blueDetail: detail }),
			match([1, 3], [2, 4], 120, 120, { redDetail: detail, blueDetail: detail }),
			match([5, 6], [1, 2], null, null)
		];
		const rate = (scoreCommon: number) =>
			rateSeason([event('A', '2026-10-01', games)], {
				params: { ...OPR_PARAMS, parts: { ...OPR_PARAMS.parts, scoreCommon } }
			}).events.get('A')!.rater;
		expect(rate(0.2).value(5, 'auto')).toBeGreaterThan(rate(0).value(5, 'auto'));
		expect(rate(0.2).value(5, 'strength')).toBeCloseTo(rate(0).value(5, 'strength'), 10);
	});

	it('ignores impossible scores', () => {
		const clean = [match([1, 2], [3, 4], 30, 70), match([1, 3], [2, 4], 40, 60)];
		const junk = match([1, 2], [3, 4], 7308, 8355);
		const base = rateSeason([event('A', '2026-10-01', clean)]);
		const dirty = rateSeason([event('A', '2026-10-01', [...clean, junk])]);
		expect(dirty.events.get('A')!.steps).toHaveLength(2);
		expect(dirty.stats.sd).toBeCloseTo(base.stats.sd, 10);
		expect(dirty.latest.get(1)!.opr).toBeCloseTo(base.latest.get(1)!.opr, 10);
	});

	it('handles a season with no matches', () => {
		const result = rateSeason([]);
		expect(result.events.size).toBe(0);
		expect(result.stats.matches).toBe(0);
		expect(result.base).toEqual(ROBOT_BASE);
	});
});

describe('softFloor', () => {
	it('leaves big values alone and keeps small ones above the floor', () => {
		expect(softFloor(2, 0, 0.25)).toBeCloseTo(2, 3);
		expect(softFloor(-1, 0, 0.25)).toBeGreaterThan(0);
		expect(softFloor(0, 0, 0.25)).toBeCloseTo(0.25 * Math.LN2, 10);
	});
});

describe('previous seasons', () => {
	it('blends seasons with the history weights', () => {
		const last = new Map<number, PriorRel>([
			[1, [1, 2]],
			[2, [0.5, 0.5]]
		]);
		const before = new Map<number, PriorRel>([
			[1, [2, 1]],
			[3, [3, 3]]
		]);
		const blended = blendPrevious([last, before], [1, 0.5]);
		expect(blended.get(1)![0]).toBeCloseTo(2 / 1.5, 10);
		expect(blended.get(1)![1]).toBeCloseTo(2.5 / 1.5, 10);
		expect(blended.get(2)).toEqual([0.5, 0.5]);
		expect(blended.get(3)).toEqual([3, 3]);
	});

	it('packs and unpacks a team map', () => {
		const map = new Map<number, PriorRel>([
			[123, [1.5, 0.25]],
			[9, [0.4, -0.1]]
		]);
		const back = previousFrom(packPrevious(map));
		expect(back.get(123)).toEqual([1.5, 0.25]);
		expect(back.get(9)).toEqual([0.4, -0.1]);
		expect(back.size).toBe(2);
	});

	it('ships priors that match the model constants', () => {
		expect(previousSeason.base.np).toBeCloseTo(ROBOT_BASE.np, 9);
		expect(previousSeason.base.robot).toBeCloseTo(ROBOT_BASE.robot, 9);
		expect(previousSeason.for).toBe(2026);
		expect(previousFrom(previousSeason).size).toBeGreaterThan(5000);
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
