import { describe, expect, it } from 'vitest';
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

const chances = { swarm: 0.5, pollinator1: 0.4, pollinator2: 0.1 };
const predict = (teams: number[]) => ({ score: teams.length * 100, chances });

describe('alliance math', () => {
	it('adds the parts of each team and takes the score and chances from the model', () => {
		const seen: number[][] = [];
		const together = alliance([auto, hive], (teams) => {
			seen.push(teams);
			return predict(teams);
		});
		expect(seen).toEqual([[724, 10662]]);
		expect(together.teams).toEqual([724, 10662]);
		expect(together.score).toBe(200);
		expect(together.chances).toEqual(chances);
		expect(together.parts).toMatchObject({ auto: 38, hive: 60, leavePark: 25 });
		expect(together.parts.tips).toBeCloseTo(3.8);
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
	const strength: Record<number, number> = { 724: 3, 10662: 2, 38372: 1 };
	const byStrength = (teams: number[]) => ({
		score: teams.reduce((sum, team) => sum + strength[team], 0),
		chances
	});

	it('builds one alliance for two teams and every pair for three, best first', () => {
		expect(
			buildFit({ numbers: [724, 10662], teams: [auto, hive], average, predict: byStrength })!
				.alliances
		).toHaveLength(1);
		const three = buildFit({
			numbers: [38372, 724, 10662],
			teams: [auto, hive, small],
			average,
			predict: byStrength
		})!;
		expect(three.teams.map((entry) => entry.number)).toEqual([38372, 724, 10662]);
		expect(three.alliances.map((entry) => entry.teams)).toEqual([
			[724, 10662],
			[38372, 724],
			[38372, 10662]
		]);
	});

	it('skips one team or four, and lists teams without a rating', () => {
		const input = { teams: [auto, hive], average, predict: byStrength };
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
