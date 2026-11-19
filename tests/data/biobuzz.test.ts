import { describe, expect, it } from 'vitest';
import {
	bottomNectar,
	breakdownParts,
	flowerOwner,
	flowerPoints,
	matchScoreCheck,
	POINTS,
	RP_THRESHOLDS,
	scoreCheck
} from '#lib/game/biobuzz.ts';
import { mapMatches } from '#lib/server/ftc/mappers.ts';
import { ftcScheduleResponse, ftcScoresResponse } from '#lib/server/ftc/schemas.ts';
import type { AllianceScore, Flowers, Match } from '#lib/types.ts';
import { FIXTURE_EVENTS, fixture } from './helpers.ts';

function fixtureMatches(code: string): Match[] {
	const event = fixture<{ events: { timezone: string }[] }>(code, 'event').events[0];
	return mapMatches({
		timezone: event.timezone,
		qualSchedule: ftcScheduleResponse.parse(fixture(code, 'schedule-qual')),
		playoffSchedule: ftcScheduleResponse.parse(fixture(code, 'schedule-playoff')),
		qualScores: ftcScoresResponse.parse(fixture(code, 'scores-qual')),
		playoffScores: ftcScoresResponse.parse(fixture(code, 'scores-playoff'))
	});
}

const empty: Flowers = { red: [], blue: [], scoring: [], audience: [] };

function score(overrides: Partial<AllianceScore> = {}): AllianceScore {
	return {
		total: 0,
		preFoulTotal: 0,
		auto: 0,
		teleop: 0,
		foulPoints: 0,
		breakdown: {
			auto: { leave: [false, false], park: [false, false], tips: 0 },
			teleop: { tips: 0, cellBalls: 0, flowers: empty, gardenBalls: 0, park: [false, false] },
			points: {
				autoLeave: 0,
				autoPark: 0,
				autoHive: 0,
				auto: 0,
				teleopHive: 0,
				teleopFlower: 0,
				teleopGarden: 0,
				teleopPark: 0,
				teleop: 0
			},
			minorFouls: 0,
			majorFouls: 0,
			foulPointsCommitted: 0,
			rp: { swarm: false, pollinator1: false, pollinator2: false }
		},
		...overrides
	};
}

describe('BIOBUZZ constants', () => {
	it('matches the game manual', () => {
		expect(POINTS).toEqual({
			leave: 3,
			park: 5,
			tip: 20,
			cellBall: 2,
			bottomNectarBonus: 5,
			flowerBall: 2,
			gardenBall: 1,
			minorFoul: 5,
			majorFoul: 20
		});
		expect(RP_THRESHOLDS).toEqual({ swarm: 16, pollinator1: 4, pollinator2: 7 });
	});
});

describe('flowers', () => {
	it('reads the API order as bottom to top', () => {
		const flower = ['pollen', 'red', 'pollen', 'blue', 'pollen'] as const;
		expect(bottomNectar([...flower])).toBe('red');
		expect(flowerOwner([...flower])).toBe('blue');
		expect(flowerOwner(['pollen', 'pollen'])).toBeNull();
		expect(bottomNectar([])).toBeNull();
	});

	it('scores owned flowers and the bottom nectar bonus', () => {
		const flowers: Flowers = {
			red: ['red', 'pollen', 'blue'],
			blue: ['pollen', 'pollen', 'pollen', 'pollen', 'pollen', 'blue'],
			scoring: ['pollen', 'pollen'],
			audience: []
		};
		expect(flowerPoints(flowers, 'red')).toBe(5);
		expect(flowerPoints(flowers, 'blue')).toBe(3 * 2 + 6 * 2 + 5);
	});
});

describe('scoreCheck', () => {
	it('accepts a consistent score and flags each broken part', () => {
		const red = score({ total: 31, preFoulTotal: 26, auto: 11, teleop: 15, foulPoints: 5 });
		red.breakdown!.auto = { leave: [true, true], park: [true, false], tips: 0 };
		red.breakdown!.teleop.park = [true, true];
		red.breakdown!.teleop.gardenBalls = 5;
		red.breakdown!.points = {
			autoLeave: 6,
			autoPark: 5,
			autoHive: 0,
			auto: 11,
			teleopHive: 0,
			teleopFlower: 0,
			teleopGarden: 5,
			teleopPark: 10,
			teleop: 15
		};
		red.breakdown!.rp.swarm = true;
		const blue = score({ total: 0 });
		blue.breakdown!.minorFouls = 1;
		blue.breakdown!.foulPointsCommitted = 5;
		expect(scoreCheck(red, blue, 'red')).toEqual([]);
		expect(scoreCheck(blue, red, 'blue')).toEqual([]);

		red.breakdown!.points.teleopGarden = 4;
		red.breakdown!.rp.pollinator1 = true;
		const issues = scoreCheck(red, blue, 'red').map((issue) => issue.field);
		expect(issues).toEqual(['teleopGarden', 'teleop', 'pollinator1']);
		expect(scoreCheck(red, blue, 'red', { checkRp: false }).map((issue) => issue.field)).toEqual([
			'teleopGarden',
			'teleop'
		]);
	});

	it('skips scores without a breakdown', () => {
		expect(scoreCheck(score({ breakdown: null }), score(), 'red')).toEqual([]);
	});

	it('finds no mismatches in any recorded match', () => {
		const mismatches: string[] = [];
		let checked = 0;
		for (const code of FIXTURE_EVENTS) {
			for (const match of fixtureMatches(code)) {
				if (!match.result) continue;
				checked++;
				const { red, blue } = matchScoreCheck(match.result);
				for (const issue of [...red, ...blue]) {
					mismatches.push(
						`${code} ${match.label} ${issue.field} expected ${issue.expected} got ${issue.actual}`
					);
				}
			}
		}
		expect(checked).toBeGreaterThan(200);
		expect(mismatches).toEqual([]);
	});

	it('splits every recorded score into parts that add up to the total', () => {
		for (const code of FIXTURE_EVENTS) {
			for (const match of fixtureMatches(code)) {
				for (const side of match.result ? [match.result.red, match.result.blue] : []) {
					const parts = breakdownParts(side);
					expect(
						parts.auto + parts.hive + parts.flower + parts.garden + parts.park + parts.fouls
					).toBe(side.total);
				}
			}
		}
	});
});
