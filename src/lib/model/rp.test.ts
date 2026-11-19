import { describe, expect, it } from 'vitest';
import {
	expectedRp,
	robotCategory,
	ROBOT_POINTS,
	RP_RULES,
	SwarmBook,
	swarmFromMean,
	swarmFromRobots,
	tipChances
} from './rp.ts';
import { poissonAtLeast } from './stats.ts';
import type { ModelMatch } from './types.ts';

const only = (points: number) => ROBOT_POINTS.map((p) => (p === points ? 1 : 0));

describe('swarm', () => {
	it('enumerates robot outcomes exactly', () => {
		expect(swarmFromRobots([only(13), only(13)])).toBe(1);
		expect(swarmFromRobots([only(13), only(0)])).toBe(0);
		expect(swarmFromRobots([only(8), only(8)])).toBe(1);
		expect(swarmFromRobots([only(10), only(5)])).toBe(0);
		const half = ROBOT_POINTS.map((p) => (p === 13 ? 0.5 : p === 0 ? 0.5 : 0));
		expect(swarmFromRobots([half, only(3)])).toBeCloseTo(0.5, 12);
		expect(swarmFromRobots([half, half])).toBeCloseTo(0.25, 12);
	});

	it('respects a custom threshold', () => {
		expect(swarmFromRobots([only(10), only(5)], { ...RP_RULES, swarm: 15 })).toBe(1);
		expect(swarmFromMean(30, 4)).toBeGreaterThan(0.99);
		expect(swarmFromMean(5, 4)).toBeLessThan(0.01);
	});

	it('maps robot points to categories', () => {
		expect(robotCategory(13)).toBe(5);
		expect(robotCategory(0)).toBe(0);
		expect(robotCategory(9)).toBe(3);
	});

	it('learns per-team rates and decays them at a new event', () => {
		const book = new SwarmBook({ prior: 1, carry: 0 });
		const m = (eventCode: string, red: number[]): ModelMatch => ({
			key: 'q1',
			eventCode,
			level: 'qual',
			time: 0,
			red: [1, 2],
			blue: [3, 4],
			redScore: 10,
			blueScore: 10,
			redNp: 10,
			blueNp: 10,
			redDetail: { robotSwarm: red },
			blueDetail: { robotSwarm: [0, 0] }
		});
		book.enterEvent('A', [1, 2, 3, 4]);
		for (let i = 0; i < 6; i++) book.update(m('A', [13, 13]));
		expect(book.chance([1, 2])).toBeGreaterThan(0.6);
		expect(book.chance([3, 4])).toBeLessThan(0.2);
		book.enterEvent('B', [1, 2]);
		const fresh = book.chance([1, 2]);
		expect(fresh).toBeLessThan(0.6);
	});
});

describe('pollinator', () => {
	it('uses a Poisson tail for tips', () => {
		const t = tipChances(3.2);
		expect(t.pollinator1).toBeCloseTo(poissonAtLeast(4, 3.2), 12);
		expect(t.pollinator2).toBeCloseTo(poissonAtLeast(7, 3.2), 12);
		expect(tipChances(-1).pollinator1).toBeGreaterThan(0);
		expect(tipChances(-1).pollinator1).toBeLessThan(1e-6);
	});
});

describe('expectedRp', () => {
	it('weights win and tie and adds bonus chances', () => {
		expect(
			expectedRp({ win: 0.5, tie: 0.1, swarm: 0.4, pollinator1: 0.2, pollinator2: 0.05 })
		).toBeCloseTo(1.5 + 0.1 + 0.65, 12);
		expect(expectedRp({ win: 1, tie: 0, swarm: 1, pollinator1: 1, pollinator2: 1 })).toBe(6);
	});
});
