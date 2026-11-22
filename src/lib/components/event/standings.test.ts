import { describe, expect, it } from 'vitest';
import type { Match } from '#lib/types.ts';
import {
	hasRpDetail,
	localRankings,
	oprShifts,
	rankShifts,
	rpCounts,
	standingsAfter
} from './standings.ts';
import { fixtureBundle } from './test-fixtures.ts';

const montana = fixtureBundle('USMTBUQ-final');
const astana = fixtureBundle('KZASQ1');
const league = fixtureBundle('USMIWMM8');

describe('standingsAfter', () => {
	it('rebuilds the official final rankings from match results', () => {
		for (const bundle of [montana, astana]) {
			const ranks = standingsAfter(bundle.matches);
			for (const row of bundle.rankings) expect(ranks.get(row.team)).toBe(row.rank);
		}
	});

	it('only counts matches up to the one asked for', () => {
		const ranks = standingsAfter(montana.matches, 'q1');
		expect(ranks.size).toBe(4);
	});
});

describe('rankShifts', () => {
	it('gives each team its rank just before and just after the match', () => {
		const shifts = rankShifts(montana.matches, 'q20')!;
		expect([...shifts.keys()].sort((a, b) => a - b)).toEqual([724, 5026, 18240, 23887]);
		expect(shifts.get(18240)).toEqual({ before: 4, after: 11 });
		expect(shifts.get(724)).toEqual({ before: 12, after: 6 });
	});

	it('has no rank before a team plays its first match', () => {
		const shifts = rankShifts(montana.matches, 'q1')!;
		for (const shift of shifts.values()) expect(shift.before).toBeNull();
	});

	it('returns nothing for playoff or unknown matches', () => {
		const playoff = montana.matches.find((match) => match.level === 'playoff')!;
		expect(rankShifts(montana.matches, playoff.key)).toBeNull();
		expect(rankShifts(montana.matches, 'q999')).toBeNull();
	});

	it('returns nothing without score breakdowns', () => {
		const bare = montana.matches.map((match): Match =>
			match.result
				? {
						...match,
						result: {
							...match.result,
							red: { ...match.result.red, breakdown: null },
							blue: { ...match.result.blue, breakdown: null }
						}
					}
				: match
		);
		expect(hasRpDetail(bare)).toBe(false);
		expect(rankShifts(bare, 'q20')).toBeNull();
		expect(rpCounts(bare)).toBeNull();
	});
});

describe('localRankings', () => {
	it('spots league rankings that carry matches from earlier meets', () => {
		expect(localRankings(montana.matches, montana.rankings)).toBe(true);
		expect(localRankings(league.matches, league.rankings)).toBe(false);
	});
});

describe('rpCounts', () => {
	it('adds up to each team official ranking score', () => {
		const counts = rpCounts(astana.matches)!;
		for (const row of astana.rankings) {
			const team = counts[row.team];
			expect(team.played).toBe(row.played);
			expect(team.wins).toBe(row.wins);
			const rp = team.wins * 3 + team.ties + team.swarm + team.pollinator1 + team.pollinator2;
			expect(rp / team.played).toBeCloseTo(row.rs, 2);
		}
	});
});

describe('oprShifts', () => {
	const ratings = [
		{
			team: 1,
			prior: 20,
			history: [
				{ key: 'q1', time: 1, opr: 22 },
				{ key: 'q4', time: 4, opr: 25 }
			]
		},
		{ team: 2, prior: 30, history: [{ key: 'q4', time: 4, opr: 28 }] },
		{ team: 3, prior: 10, history: [{ key: 'q2', time: 2, opr: 11 }] }
	];

	it('reads the rating before and after the match from each team history', () => {
		expect(oprShifts(ratings, 'q4')).toEqual({
			1: { before: 22, after: 25 },
			2: { before: 30, after: 28 }
		});
	});

	it('returns null when no team has the match', () => {
		expect(oprShifts(ratings, 'q9')).toBeNull();
	});
});
