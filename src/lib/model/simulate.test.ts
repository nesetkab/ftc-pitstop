import { describe, expect, it } from 'vitest';
import { simulateRankings, tallyResults, type SimMatch } from './simulate.ts';
import { mulberry32 } from './stats.ts';
import type { ModelMatch } from './types.ts';

function played(
	red: number[],
	blue: number[],
	r: number,
	b: number,
	extra: Partial<ModelMatch> = {}
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
		redDetail: { tips: 4, leavePoints: 6, parkPoints: 10, autoPoints: 20 },
		blueDetail: { tips: 1, leavePoints: 3, parkPoints: 5, autoPoints: 5 },
		...extra
	};
}

function even(red: number[], blue: number[], redWin = 0.49): SimMatch {
	return {
		red,
		blue,
		redWin,
		blueWin: 0.98 - redWin,
		tie: 0.02,
		redScore: 50,
		blueScore: 50,
		redSd: 15,
		blueSd: 15,
		redTips: 1,
		blueTips: 1,
		redSwarm: 0.5,
		blueSwarm: 0.5,
		redAuto: 10,
		blueAuto: 10
	};
}

describe('tallyResults', () => {
	it('counts win, swarm and pollinator points by hand', () => {
		const rows = new Map(tallyResults([played([1, 2], [3, 4], 80, 40)]).map((t) => [t.team, t]));
		expect(rows.get(1)).toEqual({ team: 1, rp: 3 + 1 + 1, np: 80, tips: 4, auto: 20, counted: 1 });
		expect(rows.get(3)!.rp).toBe(0);
	});

	it('gives one point for a tie and none to a disqualified team', () => {
		const rows = new Map(
			tallyResults([played([1, 2], [3, 4], 50, 50, { dqs: [2] })]).map((t) => [t.team, t])
		);
		expect(rows.get(1)!.rp).toBe(1 + 1 + 1);
		expect(rows.get(2)!.rp).toBe(0);
		expect(rows.get(2)!.counted).toBe(1);
		expect(rows.get(3)!.rp).toBe(1);
	});

	it('leaves surrogate and playoff matches out', () => {
		const rows = tallyResults([
			played([1, 2], [3, 4], 80, 40, { surrogates: [1] }),
			played([1, 2], [3, 4], 80, 40, { level: 'playoff' })
		]);
		expect(rows.find((t) => t.team === 1)).toBeUndefined();
		expect(rows.find((t) => t.team === 2)!.counted).toBe(1);
	});
});

describe('simulateRankings', () => {
	it('ranks by RS then TBP when nothing is left to play', () => {
		const out = simulateRankings(
			{
				teams: [1, 2, 3],
				current: [
					{ team: 1, rp: 10, np: 100, tips: 0, auto: 0, counted: 5 },
					{ team: 2, rp: 10, np: 200, tips: 0, auto: 0, counted: 5 },
					{ team: 3, rp: 15, np: 10, tips: 0, auto: 0, counted: 5 }
				],
				remaining: []
			},
			{ sims: 200 }
		);
		const rank = new Map(out.map((p) => [p.team, p.expectedRank]));
		expect(rank.get(3)).toBe(1);
		expect(rank.get(2)).toBe(2);
		expect(rank.get(1)).toBe(3);
		expect(out[0].expectedRs).toBe(2);
	});

	it('breaks full ties at random', () => {
		const tied = [1, 2].map((team) => ({ team, rp: 5, np: 50, tips: 1, auto: 1, counted: 5 }));
		const out = simulateRankings({ teams: [1, 2], current: tied, remaining: [] }, { sims: 4000 });
		expect(out[0].rankChances[0]).toBeGreaterThan(0.45);
		expect(out[0].rankChances[0]).toBeLessThan(0.55);
	});

	it('handles teams with no matches', () => {
		const out = simulateRankings({ teams: [7, 8], current: [], remaining: [] }, { sims: 10 });
		expect(out.map((p) => p.expectedRs)).toEqual([0, 0]);
		expect(out[0].rankChances.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
	});

	it('favors the team that is expected to win its remaining matches', () => {
		const out = simulateRankings(
			{
				teams: [1, 2, 3, 4],
				current: [],
				remaining: [even([1, 2], [3, 4], 0.9), even([1, 3], [2, 4], 0.9), even([1, 4], [2, 3], 0.9)]
			},
			{ sims: 3000 }
		);
		const one = out.find((p) => p.team === 1)!;
		expect(one.rankChances[0]).toBeGreaterThan(0.6);
		expect(one.top4).toBe(1);
		expect(one.expectedRs).toBeGreaterThan(out.find((p) => p.team === 4)!.expectedRs);
	});

	it('does not count surrogate matches', () => {
		const out = simulateRankings(
			{
				teams: [1, 2, 3, 4],
				current: [],
				remaining: [{ ...even([1, 2], [3, 4], 0.98), surrogates: [1] }]
			},
			{ sims: 500 }
		);
		expect(out.find((p) => p.team === 1)!.expectedRs).toBe(0);
		expect(out.find((p) => p.team === 2)!.expectedRs).toBeGreaterThan(2.5);
	});

	it('runs 10,000 simulations of a 40-team event quickly', () => {
		const rng = mulberry32(5);
		const teams = Array.from({ length: 40 }, (_, i) => 100 + i);
		const remaining: SimMatch[] = [];
		for (let round = 0; round < 8; round++) {
			const order = [...teams].sort(() => rng() - 0.5);
			for (let k = 0; k < 10; k++)
				remaining.push(
					even(order.slice(4 * k, 4 * k + 2), order.slice(4 * k + 2, 4 * k + 4), rng())
				);
		}
		simulateRankings({ teams, current: [], remaining }, { sims: 500 });
		const t0 = performance.now();
		const out = simulateRankings({ teams, current: [], remaining }, { sims: 10000 });
		const ms = performance.now() - t0;
		expect(out).toHaveLength(40);
		expect(out.reduce((s, p) => s + p.top4, 0)).toBeCloseTo(4, 6);
		expect(ms).toBeLessThan(900);
	});
});
