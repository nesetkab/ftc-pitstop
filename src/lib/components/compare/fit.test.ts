import { describe, expect, it } from 'vitest';
import { calibratedSwarm, calibratedTips } from '#lib/model/rp.ts';
import {
	alliance,
	averageParts,
	buildFit,
	emptyParts,
	fitNotes,
	pairsOf,
	sumParts,
	type FitParts,
	type FitTeam
} from './fit.ts';

function parts(overrides: Partial<FitParts>): FitParts {
	return { ...emptyParts(), ...overrides };
}

function team(number: number, overrides: Partial<FitParts>): FitTeam {
	const p = parts(overrides);
	return { number, opr: p.auto + p.teleop, parts: p };
}

const average = parts({
	auto: 8,
	teleop: 18,
	hive: 13,
	flower: 1,
	garden: 4,
	park: 4,
	leavePark: 9,
	tips: 0.7
});

const auto = team(724, {
	auto: 31,
	teleop: 31,
	hive: 25,
	garden: 1,
	park: 5,
	leavePark: 14,
	tips: 2.2
});
const hive = team(10662, {
	auto: 7,
	teleop: 41,
	hive: 35,
	garden: 1,
	park: 5,
	leavePark: 11,
	tips: 1.6
});
const small = team(38372, { auto: 14, teleop: 4, hive: 1, park: 3, leavePark: 6, tips: 0.4 });

describe('alliance math', () => {
	it('adds the parts and OPR of each team', () => {
		const together = alliance([auto, hive], () => 0.5);
		expect(together.teams).toEqual([724, 10662]);
		expect(together.score).toBe(110);
		expect(together.parts).toMatchObject({ auto: 38, hive: 60, leavePark: 25 });
		expect(together.parts.tips).toBeCloseTo(3.8);
	});

	it('uses the model helpers for ranking point chances', () => {
		const together = alliance([auto, hive], () => 0.5);
		const tips = calibratedTips(3.8);
		expect(together.chances.swarm).toBeCloseTo(calibratedSwarm(0.5, 25));
		expect(together.chances.pollinator1).toBeCloseTo(tips.pollinator1);
		expect(together.chances.pollinator2).toBeCloseTo(tips.pollinator2);
		expect(together.chances.pollinator2).toBeLessThanOrEqual(together.chances.pollinator1);
	});

	it('gives better chances to a stronger pair', () => {
		const strong = alliance([auto, hive], () => 0.8);
		const weak = alliance([small, small], () => 0.1);
		expect(strong.chances.swarm).toBeGreaterThan(weak.chances.swarm);
		expect(strong.chances.pollinator1).toBeGreaterThan(weak.chances.pollinator1);
	});

	it('sums and averages parts and lists every pair', () => {
		expect(sumParts([parts({ hive: 2 }), parts({ hive: 3 })]).hive).toBe(5);
		expect(averageParts([parts({ hive: 2 }), parts({ hive: 4 })]).hive).toBe(3);
		expect(averageParts([])).toEqual(emptyParts());
		expect(pairsOf([1, 2, 3])).toEqual([
			[1, 2],
			[1, 3],
			[2, 3]
		]);
	});
});

describe('buildFit', () => {
	const swarm = (teams: number[]) => teams.length / 4;

	it('builds one alliance for two teams and every pair for three, best first', () => {
		expect(
			buildFit({ numbers: [724, 10662], teams: [auto, hive], average, robotSwarm: swarm })!
				.alliances
		).toHaveLength(1);
		const three = buildFit({
			numbers: [38372, 724, 10662],
			teams: [auto, hive, small],
			average,
			robotSwarm: swarm
		})!;
		expect(three.teams.map((entry) => entry.number)).toEqual([38372, 724, 10662]);
		expect(three.alliances.map((entry) => entry.teams)).toEqual([
			[724, 10662],
			[38372, 724],
			[38372, 10662]
		]);
	});

	it('skips one team or four, and lists teams without a rating', () => {
		const input = { teams: [auto, hive], average, robotSwarm: swarm };
		expect(buildFit({ ...input, numbers: [724] })).toBeNull();
		expect(buildFit({ ...input, numbers: [724, 10662, 1, 2] })).toBeNull();
		const partial = buildFit({ ...input, numbers: [724, 5] })!;
		expect(partial.missing).toEqual([5]);
		expect(partial.alliances).toEqual([]);
		expect(partial.notes).toEqual([]);
	});
});

describe('fitNotes', () => {
	it('says when each team leans on a different part and who brings most of one', () => {
		expect(fitNotes([auto, hive], average)).toEqual([
			"Each team's biggest part is different: 724 auto and 10662 hive.",
			'724 brings 82% of the combined auto points.',
			'Neither team is above average in garden (1.0 and 1.0, average 4.0).'
		]);
	});

	it('says when teams lean on the same part', () => {
		const twin = team(5, { auto: 5, teleop: 40, hive: 30, park: 5, garden: 5, tips: 2 });
		expect(fitNotes([hive, twin], average)[0]).toBe(
			'Hive is the biggest part for both teams (35.0 and 30.0 points).'
		);
		expect(fitNotes([auto, hive, small], average)[0]).toBe(
			'Auto is the biggest part for 724 and 38372 (31.0 and 14.0 points).'
		);
		const triple = [hive, twin, team(6, { auto: 1, teleop: 20, hive: 20 })];
		expect(fitNotes(triple, average)[0]).toBe(
			'Hive is the biggest part for all three teams (35.0, 30.0 and 20.0 points).'
		);
	});

	it('ignores parts too small to matter and stays within four notes', () => {
		const notes = fitNotes([auto, hive, small], average);
		expect(notes.length).toBeLessThanOrEqual(4);
		expect(notes.some((note) => note.includes('flower'))).toBe(false);
		expect(fitNotes([auto], average)).toEqual([]);
	});
});
