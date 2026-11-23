import { describe, expect, it } from 'vitest';
import type { MatchForecast } from '#lib/analysis/types.ts';
import { emptyParts, type FitParts } from '#lib/components/compare/fit.ts';
import {
	decisionNotes,
	headline,
	isCanonical,
	isFull,
	parseSides,
	scoreRange,
	simulateHref,
	swapped,
	withoutTeam,
	type SimSide
} from './simulate.ts';

const params = (query: string) => new URLSearchParams(query);

describe('simulator links', () => {
	it('reads two teams a side and drops repeats', () => {
		expect(parseSides(params('red=724,10662&blue=5026,4133'))).toEqual({
			red: [724, 10662],
			blue: [5026, 4133]
		});
		expect(parseSides(params('red=724,724,1,2&blue=724,9'))).toEqual({ red: [724, 1], blue: [9] });
		expect(parseSides(params('red=abc,0,1234567&blue='))).toEqual({ red: [], blue: [] });
	});

	it('reads the picker form fields', () => {
		expect(parseSides(params('r1=724&r2=&b1=5026&b2=4133'))).toEqual({
			red: [724],
			blue: [5026, 4133]
		});
		expect(parseSides(params('r1=The+Hive&r2=10662'))).toEqual({ red: [10662], blue: [] });
	});

	it('builds the share link and knows when a link is already canonical', () => {
		const sides = { red: [724, 10662], blue: [5026, 4133] };
		expect(simulateHref(sides)).toBe('/simulate?red=724,10662&blue=5026,4133');
		expect(simulateHref({ red: [], blue: [9] })).toBe('/simulate?blue=9');
		expect(simulateHref({ red: [], blue: [] })).toBe('/simulate');
		expect(isCanonical(params('red=724%2C10662&blue=5026,4133'), sides)).toBe(true);
		expect(isCanonical(params('red=724,10662,1&blue=5026,4133'), sides)).toBe(false);
		expect(isCanonical(params('r1=724'), { red: [724], blue: [] })).toBe(false);
		expect(isCanonical(params(''), { red: [], blue: [] })).toBe(true);
	});

	it('swaps, removes and checks for a full match', () => {
		const sides = { red: [1, 2], blue: [3, 4] };
		expect(swapped(sides)).toEqual({ red: [3, 4], blue: [1, 2] });
		expect(withoutTeam(sides, 3)).toEqual({ red: [1, 2], blue: [4] });
		expect(isFull(sides)).toBe(true);
		expect(isFull(withoutTeam(sides, 3))).toBe(false);
	});

	it('keeps the score range above zero', () => {
		expect(scoreRange(100, 10).low).toBeCloseTo(87.18, 2);
		expect(scoreRange(100, 10).high).toBeCloseTo(112.82, 2);
		expect(scoreRange(10, 30).low).toBe(0);
	});
});

function side(color: 'red' | 'blue', parts: Partial<FitParts>): SimSide {
	const all = { ...emptyParts(), ...parts };
	const np = all.auto + all.teleop;
	return { color, teams: [], score: np, np, fouls: 0, low: 0, high: 0, parts: all };
}

function forecast(redWin: number, blueWin: number, rp: Partial<Record<string, number>> = {}) {
	const alliance = (win: number, prefix: 'red' | 'blue') => ({
		score: 0,
		sd: 0,
		win,
		rp: {
			win,
			tie: 0,
			swarm: rp[`${prefix}Swarm`] ?? 0.5,
			pollinator1: rp[`${prefix}P1`] ?? 0.5,
			pollinator2: 0.01,
			expected: 0
		}
	});
	return {
		key: 'simulate',
		red: alliance(redWin, 'red'),
		blue: alliance(blueWin, 'blue'),
		tie: 1 - redWin - blueWin,
		played: false,
		correct: null
	} satisfies MatchForecast;
}

describe('where the match is decided', () => {
	const red = side('red', { auto: 30, teleop: 60, hive: 50, garden: 4, park: 6, tips: 5.2 });
	const blue = side('blue', { auto: 12, teleop: 50, hive: 38, garden: 10, park: 2, tips: 2.1 });

	it('names the biggest gap, the underdog way back and a ranking point split', () => {
		const notes = decisionNotes(
			red,
			blue,
			forecast(0.8, 0.18, { redP1: 0.75, blueP1: 0.2 }),
			28,
			30
		);
		expect(notes).toEqual([
			"Auto is the biggest gap: Red is expected to score 30.0 auto points to Blue's 12.0.",
			"Blue's way back is garden, where it is expected to lead by 6.0 points.",
			"Pollinator 1 separates them: it needs 4 tips, Red averages 5.2 to Blue's 2.1, so Red gets it 75% of the time and Blue 20%."
		]);
	});

	it('calls a close match a coin flip and says when no part separates them', () => {
		const even = side('blue', { auto: 29, teleop: 60, hive: 49, garden: 5, park: 6, tips: 5 });
		const notes = decisionNotes(red, even, forecast(0.5, 0.48), 1, 30);
		expect(notes[0]).toBe(
			'This one is close to a coin flip: the expected margin of 1 points is small next to a normal swing of about 30.'
		);
		expect(notes[1]).toBe('No single part separates them: every scoring part is within 3 points.');
		expect(notes).toHaveLength(2);
	});

	it('says when the underdog leads nowhere', () => {
		const weak = side('blue', { auto: 10, teleop: 20, hive: 15, garden: 2, park: 2 });
		expect(decisionNotes(red, weak, forecast(0.95, 0.04), 60, 30)[1]).toBe(
			'Blue does not lead in any scoring part, so it needs Red to have an off match.'
		);
	});

	it('sums the odds up in one line', () => {
		expect(headline({ forecast: forecast(0.64, 0.34) })).toBe(
			'Red is favored: it wins 64% of the time, Blue 34%, tie 2%.'
		);
		expect(headline({ forecast: forecast(0.45, 0.53) })).toBe(
			'Too close to call: Red wins 45%, Blue 53%, tie 2%.'
		);
	});
});
