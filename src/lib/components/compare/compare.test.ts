import { describe, expect, it } from 'vitest';
import type { SeasonRatings } from '#lib/analysis/types.ts';
import { match, teamEvent, teamSeason } from '#lib/components/team/fixtures.ts';
import type { Match, TeamEventStats, TeamSeasonEvent } from '#lib/types.ts';
import {
	buildComparison,
	compareHref,
	parseTeamList,
	sharedEventCodes,
	suggestNeighbors
} from './compare.ts';

function stats(rank: number, wins: number, losses: number, opr = 50): TeamEventStats {
	return {
		rank,
		rs: 0,
		tbp: 0,
		avgTips: 0,
		wins,
		losses,
		ties: 0,
		dq: 0,
		played: wins + losses,
		opr: { total: opr, auto: 10, teleop: opr - 10 }
	};
}

function attended(code: string, start: string, value: TeamEventStats | null): TeamSeasonEvent {
	return { ...teamEvent({ code, name: `${code} Qualifier`, start, end: start }), stats: value };
}

function played(number: number, red: number[], blue: number[], winner: 'red' | 'blue' | null) {
	const base = match(number, red, blue, '2026-11-14T16:00:00Z', true);
	const score = (total: number) => ({ ...base.result!.red, total });
	return {
		...base,
		result: {
			red: score(winner === 'blue' ? 80 : 100),
			blue: score(winner === 'red' ? 80 : 100),
			winner
		}
	} satisfies Match;
}

function ratings(list: [number, number][]): SeasonRatings {
	return {
		generatedAt: 1,
		teams: list.map(([team, opr], index) => ({
			team,
			opr,
			parts: { auto: opr / 5, hive: opr / 2, flower: 1, garden: 2, park: 5, tips: 3 },
			matches: 10,
			events: 2,
			rank: index + 1,
			percentile: 0.5,
			region: 'USAZ'
		}))
	};
}

const alpha = teamSeason(100, 'Alpha', [
	attended('AAA', '2026-11-07', stats(1, 5, 0, 80)),
	attended('BBB', '2026-11-14', stats(3, 4, 1, 70)),
	attended('CCC', '2026-12-05', null)
]);
alpha.events[1].awards = [
	{ id: 13, name: 'Winning Alliance', placement: 1, team: 100, person: null },
	{ id: 9, name: 'Think Award', placement: 1, team: 100, person: null }
];
const bravo = teamSeason(200, 'Bravo', [
	attended('BBB', '2026-11-14', stats(2, 3, 2, 60)),
	attended('CCC', '2026-12-05', null)
]);
const charlie = teamSeason(300, 'Charlie', [attended('DDD', '2026-11-21', stats(6, 2, 3))]);

const bundles = {
	BBB: {
		matches: [
			played(1, [100, 200], [7, 8], 'red'),
			played(2, [100, 9], [200, 10], 'blue'),
			played(3, [200, 11], [100, 12], null),
			played(4, [100, 13], [14, 15], 'red'),
			match(5, [100, 200], [16, 17], '2026-11-14T18:00:00Z', false)
		]
	}
};

describe('parseTeamList', () => {
	it('reads numbers from commas, spaces and plus signs, without repeats', () => {
		expect(parseTeamList('19666, 7759+7759', '21229 abc 0 1234567')).toEqual([19666, 7759, 21229]);
		expect(parseTeamList('1,2,3,4,5')).toEqual([1, 2, 3, 4]);
		expect(parseTeamList(null, undefined)).toEqual([]);
	});

	it('builds a canonical link', () => {
		expect(compareHref([19666, 7759])).toBe('/compare?teams=19666,7759');
		expect(compareHref([])).toBe('/compare');
	});
});

describe('buildComparison', () => {
	const view = buildComparison({
		seasons: [alpha, bravo, charlie],
		ratings: ratings([
			[100, 120],
			[300, 90],
			[200, 60]
		]),
		bundles
	});
	const rowOf = (key: string) => view.rows.find((row) => row.key === key)!;

	it('lines up season numbers and marks the best value', () => {
		expect(view.source).toBe('ratings');
		expect(view.teams.map((team) => team.number)).toEqual([100, 200, 300]);
		expect(rowOf('opr')).toMatchObject({ values: ['120.0', '60.0', '90.0'], best: [0] });
		expect(rowOf('rank')).toMatchObject({ values: ['1', '3', '2'], best: [0] });
		expect(rowOf('record')).toMatchObject({ values: ['9-1-0', '3-2-0', '2-3-0'], best: [0] });
		expect(rowOf('winrate').values).toEqual(['90%', '60%', '40%']);
		expect(rowOf('bestRank')).toMatchObject({ values: ['1', '2', '6'], best: [0] });
		expect(rowOf('eventWins')).toMatchObject({ values: ['1', '0', '0'], best: [0] });
		expect(rowOf('awards')).toMatchObject({ values: ['1', '0', '0'], best: [0] });
		expect(rowOf('events')).toMatchObject({ values: ['2', '1', '1'], best: [] });
		expect(rowOf('flower').best).toEqual([]);
	});

	it('marks every value that shows the same as the best one', () => {
		const team = (number: number, wins: number, losses: number) =>
			teamSeason(number, `T${number}`, [
				attended(`E${number}`, '2026-11-07', stats(1, wins, losses))
			]);
		const close = buildComparison({
			seasons: [team(1, 9, 2), team(2, 9, 2), team(3, 8, 2)],
			ratings: ratings([
				[1, 90.04],
				[2, 90.01],
				[3, 89.9]
			]),
			bundles: {}
		});
		const closeRow = (key: string) => close.rows.find((entry) => entry.key === key)!;
		expect(closeRow('record')).toMatchObject({ values: ['9-2-0', '9-2-0', '8-2-0'], best: [0, 1] });
		expect(closeRow('winrate')).toMatchObject({ values: ['82%', '82%', '80%'], best: [0, 1] });
		expect(closeRow('opr')).toMatchObject({ values: ['90.0', '90.0', '89.9'], best: [0, 1] });
		expect(closeRow('bestRank').best).toEqual([]);

		const level = buildComparison({
			seasons: [team(1, 9, 2), team(2, 18, 4)],
			ratings: null,
			bundles: {}
		});
		const levelRow = (key: string) => level.rows.find((entry) => entry.key === key)!;
		expect(levelRow('record')).toMatchObject({ values: ['9-2-0', '18-4-0'], best: [] });
		expect(levelRow('winrate')).toMatchObject({ values: ['82%', '82%'], best: [] });
	});

	it('counts results as partners and as opponents', () => {
		expect(view.pairs).toEqual([
			{
				a: 100,
				b: 200,
				together: { wins: 1, losses: 0, ties: 0 },
				against: { wins: 0, losses: 1, ties: 1 }
			},
			{ a: 100, b: 300, together: emptyTally(), against: emptyTally() },
			{ a: 200, b: 300, together: emptyTally(), against: emptyTally() }
		]);
		expect(view.meetings.map((meeting) => meeting.key)).toEqual(['q1', 'q2', 'q3']);
		expect(view.meetings[1]).toMatchObject({
			code: 'BBB',
			event: 'BBB Qualifier',
			red: [100, 9],
			blue: [200, 10],
			redScore: 80,
			blueScore: 100,
			winner: 'blue'
		});
	});

	it('lists events where two or more teams were entered, newest first', () => {
		expect(view.shared.map((event) => event.code)).toEqual(['CCC', 'BBB']);
		expect(view.shared[1].cells).toEqual([
			{
				attending: true,
				rank: 3,
				record: '4-1-0',
				opr: 70,
				awards: ['Winning alliance', 'Think Award']
			},
			{ attending: true, rank: 2, record: '3-2-0', opr: 60, awards: [] },
			{ attending: false, rank: null, record: null, opr: null, awards: [] }
		]);
		expect(sharedEventCodes([alpha, bravo, charlie])).toEqual(['BBB']);
	});

	it('falls back to FTCScout quick stats when ratings are missing', () => {
		const quick = { ...alpha, quickStats: quickStats(110, 4) };
		const fallback = buildComparison({ seasons: [quick, bravo], ratings: null, bundles: {} });
		expect(fallback.source).toBe('scout');
		expect(fallback.rows.find((row) => row.key === 'opr')).toMatchObject({
			label: 'Best event OPR',
			values: ['110.0', '—'],
			best: []
		});
		expect(fallback.meetings).toEqual([]);
	});
});

describe('suggestNeighbors', () => {
	const pool = ratings([
		[1, 200],
		[2, 190],
		[3, 180],
		[4, 170],
		[5, 160]
	]);

	it('suggests teams close in OPR', () => {
		expect(suggestNeighbors(pool, [3])).toEqual([2, 4, 1]);
	});

	it('suggests the top teams when nothing is picked', () => {
		expect(suggestNeighbors(pool, [], 2)).toEqual([1, 2]);
		expect(suggestNeighbors(null, [3])).toEqual([]);
	});
});

function emptyTally() {
	return { wins: 0, losses: 0, ties: 0 };
}

function quickStats(total: number, rank: number) {
	const stat = (value: number) => ({ value, rank });
	return {
		season: 2026,
		total: stat(total),
		auto: stat(20),
		teleop: stat(total - 20),
		endgame: stat(0),
		count: 5000
	};
}
