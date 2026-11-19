import { describe, expect, it } from 'vitest';
import {
	allianceCountFor,
	analyzePicks,
	bracketFor,
	fillAlliances,
	resolveBracket,
	simulateBracket,
	upperFinal,
	type AllianceCount,
	type Color
} from './bracket.ts';

const pairs = (size: AllianceCount, results: Record<number, Color>) =>
	resolveBracket(size, results).matches.map((m) => [
		m.match,
		m.redAlliance,
		m.blueAlliance,
		m.needed
	]);

describe('bracket structure', () => {
	it('has the manual match counts and if-needed finals', () => {
		expect(bracketFor(2).map((m) => m.match)).toEqual([1, 2, 3]);
		expect(bracketFor(4)).toHaveLength(7);
		expect(bracketFor(6)).toHaveLength(11);
		expect(bracketFor(8)).toHaveLength(15);
		for (const size of [2, 4, 6, 8] as const) {
			const table = bracketFor(size);
			expect(table.filter((m) => m.ifNeeded)).toHaveLength(1);
			expect(table[table.length - 1].ifNeeded).toBe(true);
		}
	});

	it('seeds round 1 with the higher seed on red', () => {
		expect(pairs(8, {}).slice(0, 4)).toEqual([
			[1, 1, 8, true],
			[2, 4, 5, true],
			[3, 2, 7, true],
			[4, 3, 6, true]
		]);
		expect(pairs(4, {}).slice(0, 2)).toEqual([
			[1, 1, 4, true],
			[2, 2, 3, true]
		]);
	});

	it('sizes playoffs by team count', () => {
		expect([3, 4, 10, 11, 20, 21, 40, 41, 64].map(allianceCountFor)).toEqual([
			0, 2, 2, 4, 4, 6, 6, 8, 8
		]);
	});
});

describe('resolveBracket', () => {
	it('reproduces the Gilbert six alliance playoffs', () => {
		const results: Record<number, Color> = {
			1: 'blue',
			2: 'red',
			3: 'red',
			4: 'red',
			5: 'blue',
			6: 'red',
			7: 'blue',
			8: 'red',
			9: 'red',
			10: 'red'
		};
		const state = resolveBracket(6, results);
		expect(state.matches.map((m) => [m.redAlliance, m.blueAlliance])).toEqual([
			[4, 5],
			[3, 6],
			[1, 5],
			[2, 3],
			[5, 6],
			[3, 4],
			[1, 2],
			[3, 6],
			[1, 3],
			[2, 1],
			[2, 1]
		]);
		expect(state.champion).toBe(2);
		expect(state.finalist).toBe(1);
		expect(state.matches[10].needed).toBe(false);
		expect(state.done).toBe(true);
	});

	it('plays the extra final when the lower bracket alliance wins the first final', () => {
		const lower = resolveBracket(4, {
			1: 'red',
			2: 'red',
			3: 'blue',
			4: 'red',
			5: 'blue',
			6: 'blue'
		});
		expect(lower.matches[5].redAlliance).toBe(1);
		expect(lower.matches[5].blueAlliance).toBe(3);
		expect(lower.matches[6].needed).toBe(true);
		expect(lower.champion).toBeNull();
		const done = resolveBracket(4, {
			1: 'red',
			2: 'red',
			3: 'blue',
			4: 'red',
			5: 'blue',
			6: 'blue',
			7: 'blue'
		});
		expect(done.champion).toBe(3);
		expect(done.finalist).toBe(1);
	});

	it('runs two alliance finals as first to two wins', () => {
		expect(resolveBracket(2, { 1: 'red', 2: 'red' }).champion).toBe(1);
		expect(resolveBracket(2, { 1: 'red', 2: 'red' }).matches[2].needed).toBe(false);
		const split = resolveBracket(2, { 1: 'red', 2: 'blue' });
		expect(split.champion).toBeNull();
		expect(split.matches[2].needed).toBe(true);
		expect(resolveBracket(2, { 1: 'red', 2: 'blue', 3: 'blue' }).champion).toBe(2);
	});

	it('leaves later matches open until results arrive', () => {
		const state = resolveBracket(8, { 1: 'red' });
		expect(state.matches[4].redAlliance).toBe(8);
		expect(state.matches[4].blueAlliance).toBeNull();
		expect(state.matches[6].redAlliance).toBe(1);
		expect(state.matches[14].needed).toBeNull();
	});
});

describe('simulateBracket', () => {
	it('sums to one and favors the strongest alliance', () => {
		const power = [0, 9, 3, 2, 1, 1, 1, 1, 1];
		const odds = simulateBracket(8, (r, b) => power[r] / (power[r] + power[b]), new Map(), 4000);
		expect(odds.reduce((s, o) => s + o.champion, 0)).toBeCloseTo(1, 10);
		expect(odds.reduce((s, o) => s + o.finalist, 0)).toBeCloseTo(1, 10);
		expect(odds[0].champion).toBeGreaterThan(0.5);
		expect(odds[0].reachRound[0]).toBe(1);
		expect(odds.reduce((s, o) => s + o.upperFinal, 0)).toBeCloseTo(2, 10);
	});

	it('respects results already played', () => {
		const odds = simulateBracket(
			2,
			() => 0.5,
			new Map<number, Color>([
				[1, 'red'],
				[2, 'red']
			]),
			100
		);
		expect(odds[0].champion).toBe(1);
		const six = simulateBracket(6, () => 0.5, { 1: 'red', 2: 'red' }, 2000);
		expect(six[4].reachRound[1]).toBe(0);
		expect(six[0].firstMatchWin).toBeGreaterThan(0.4);
		expect(upperFinal(6)).toBe(7);
	});
});

describe('pick analysis', () => {
	const ranking = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
	const strength = (t: number) =>
		({ 11: 50, 12: 40, 13: 20, 14: 10, 15: 60, 16: 5, 17: 4, 18: 3, 19: 2, 20: 1 })[t] ?? 0;
	const winProb = (red: number[], blue: number[]) => {
		const s = (a: number[]) => a.reduce((x, t) => x + strength(t), 0);
		return 1 / (1 + Math.exp(-(s(red) - s(blue)) / 10));
	};

	it('promotes captains when a captain is picked', () => {
		const filled = fillAlliances({ alliances: 4, ranking, formed: [], strength, winProb }, 12);
		expect(filled[0]).toEqual([11, 12]);
		expect(filled[1][0]).toBe(13);
		expect(filled.map((a) => a[0])).toEqual([11, 13, 14, 17]);
		expect(filled[1][1]).toBe(15);
	});

	it('ranks options for the alliance on the clock', () => {
		const options = analyzePicks(
			{ alliances: 4, ranking, formed: [], strength, winProb, declined: [20] },
			{ sims: 1500 }
		);
		expect(options.map((o) => o.team)).not.toContain(20);
		expect(options).toHaveLength(8);
		expect(options[0].team).toBe(15);
		expect(options.find((o) => o.team === 12)!.promotes).toBe(true);
		expect(options.find((o) => o.team === 15)!.promotes).toBe(false);
		expect(options[0].champion).toBeGreaterThan(options[options.length - 1].champion);
		for (const o of options) expect(o.firstMatchWin).toBeGreaterThanOrEqual(o.upperFinal - 1e-9);
	});

	it('continues from alliances already formed', () => {
		const options = analyzePicks(
			{ alliances: 2, ranking, formed: [[11, 15]], strength, winProb },
			{ sims: 500 }
		);
		expect(options[0].alliances[0]).toEqual([11, 15]);
		expect(options[0].alliances[1][0]).toBe(12);
		expect(options.map((o) => o.team)).not.toContain(12);
	});
});
