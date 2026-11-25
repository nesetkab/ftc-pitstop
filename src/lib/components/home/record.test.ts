import { describe, expect, it } from 'vitest';
import type { SeasonMatch, SeasonMatchAlliance } from '#lib/types.ts';
import { worldRecord } from './record.ts';

function alliance(teams: number[], np: number, fouls = 0): SeasonMatchAlliance {
	return {
		teams,
		surrogates: [],
		noShows: [],
		dqs: [],
		total: np + fouls,
		preFoulTotal: np,
		auto: 20,
		teleop: np - 20,
		hive: 0,
		flower: 0,
		garden: 0,
		park: 0,
		foulPoints: fouls,
		tips: 0,
		leavePark: 0,
		robots: [],
		rp: { swarm: false, pollinator1: false, pollinator2: false }
	};
}

function game(
	key: string,
	red: SeasonMatchAlliance,
	blue: SeasonMatchAlliance,
	date = '2026-11-21',
	code = 'USAZGIQ'
): SeasonMatch {
	return {
		eventCode: code,
		eventType: 'Qualifier',
		region: 'USAZ',
		date,
		end: date,
		time: null,
		key,
		level: key.startsWith('q') ? 'qual' : 'playoff',
		series: 0,
		number: Number(key.slice(1)),
		red,
		blue
	};
}

describe('worldRecord', () => {
	it('ranks alliances by score without foul points', () => {
		const record = worldRecord([
			game('q1', alliance([1, 2], 150, 60), alliance([3, 4], 90)),
			game('q2', alliance([5, 6], 120), alliance([7, 8], 180, 5))
		]);
		expect(record).toEqual({
			event: 'USAZGIQ',
			key: 'q2',
			label: 'Q2',
			day: '2026-11-21',
			alliance: 'blue',
			red: [5, 6],
			blue: [7, 8],
			redScore: 120,
			blueScore: 180,
			ties: 0
		});
	});

	it('keeps the first alliance to reach a tied score and counts the rest', () => {
		const record = worldRecord([
			game('p7', alliance([1, 2], 288), alliance([3, 4], 155), '2026-11-21', 'USMITEQ'),
			game('p5', alliance([5, 6], 288), alliance([7, 8], 188), '2026-11-15', 'CNSHQ2'),
			game('q3', alliance([9, 10], 100), alliance([11, 12], 288), '2026-11-22')
		]);
		expect(record).toMatchObject({ event: 'CNSHQ2', key: 'p5', label: 'M5', ties: 2 });
	});

	it('skips implausible scores and matches without both alliances', () => {
		const broken = alliance([1, 2], 200);
		broken.teleop = 10;
		const record = worldRecord([
			game('q1', broken, alliance([3, 4], 50)),
			game('q2', alliance([], 250), alliance([5, 6], 40)),
			game('q3', alliance([7, 8], 120), alliance([9, 10], 60))
		]);
		expect(record).toMatchObject({ key: 'q3', redScore: 120 });
	});

	it('returns nothing before any points are scored', () => {
		expect(worldRecord([])).toBeNull();
		expect(worldRecord([game('q1', alliance([1, 2], 0), alliance([3, 4], 0))])).toBeNull();
	});
});
