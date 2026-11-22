import { describe, expect, it } from 'vitest';
import type { SeasonMatch, SeasonMatchAlliance } from '#lib/types.ts';
import { buildHighlights, TODAY_MINIMUM } from './highlights.ts';

const TODAY = '2026-11-21';

function alliance(teams: number[], total: number): SeasonMatchAlliance {
	return {
		teams,
		surrogates: [],
		noShows: [],
		dqs: [],
		total,
		preFoulTotal: total,
		auto: 20,
		teleop: total - 20,
		hive: 0,
		flower: 0,
		garden: 0,
		park: 0,
		foulPoints: 0,
		tips: 0,
		leavePark: 0,
		robots: [],
		rp: { swarm: false, pollinator1: false, pollinator2: false }
	};
}

function game(
	number: number,
	red: number,
	blue: number,
	date = TODAY,
	code = 'USAZGIQ'
): SeasonMatch {
	return {
		eventCode: code,
		eventType: 'Qualifier',
		region: 'USAZ',
		date,
		end: date,
		time: null,
		key: `q${number}`,
		level: 'qual',
		series: 0,
		number,
		red: alliance([number, number + 1000], red),
		blue: alliance([number + 2000, number + 3000], blue)
	};
}

const noChance = () => null;

describe('buildHighlights', () => {
	it('picks the highest scores, closest games and upsets of the week', () => {
		const matches = [
			game(1, 200, 100, '2026-11-19'),
			game(2, 150, 148, '2026-11-20'),
			game(3, 120, 160),
			game(4, 90, 30),
			game(5, 60, 61),
			game(6, 300, 10, '2026-11-01')
		];
		const chances: Record<string, number> = { q3: 0.2, q4: 0.95, q2: 0.45 };
		const result = buildHighlights(matches, TODAY, (match) => chances[match.key] ?? null);
		expect(result?.range).toBe('week');
		expect(result?.highest.map((item) => item.key)).toEqual(['q1', 'q3', 'q2']);
		expect(result?.closest.map((item) => item.key)).toEqual(['q2', 'q3', 'q1']);
		expect(result?.upsets).toEqual([
			{
				event: 'USAZGIQ',
				key: 'q3',
				label: 'Q3',
				red: [3, 1003],
				blue: [2003, 3003],
				redScore: 120,
				blueScore: 160,
				winner: 'blue',
				chance: 0.2
			}
		]);
	});

	it('switches to today once enough matches have been played today', () => {
		const matches = [
			game(99, 280, 10, '2026-11-20'),
			...Array.from({ length: TODAY_MINIMUM }, (_, index) => game(index + 1, 100 + index, 90))
		];
		const result = buildHighlights(matches, TODAY, noChance);
		expect(result?.range).toBe('today');
		expect(result?.highest[0].key).toBe(`q${TODAY_MINIMUM}`);
		expect(result?.upsets).toEqual([]);
	});

	it('skips scores that cannot be real and unplayed matches', () => {
		const broken = game(1, 7308, 8355);
		const empty = game(2, 0, 0);
		const lopsided = {
			...game(3, 150, 100),
			red: { ...alliance([3, 4], 150), auto: 0, teleop: 0 }
		};
		const result = buildHighlights([broken, empty, lopsided, game(4, 140, 120)], TODAY, noChance);
		expect(result?.highest.map((item) => item.key)).toEqual(['q4']);
	});

	it('has nothing to show without matches this week', () => {
		expect(buildHighlights([game(1, 100, 90, '2026-10-01')], TODAY, noChance)).toBeNull();
	});
});
