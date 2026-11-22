import { describe, expect, it } from 'vitest';
import type { SeasonRating } from '#lib/analysis/types.ts';
import {
	followedBundle,
	match,
	ranking,
	teamEvent,
	teamSeason
} from '#lib/components/team/fixtures.ts';
import type { Match } from '#lib/types.ts';
import {
	followedTeam,
	liveStatus,
	MAX_FOLLOWED,
	parseTeamList,
	teamListQuery
} from './followed.ts';

const NOW = Date.parse('2026-11-14T20:41:00Z');

function rating(team: number, opr: number, rank: number): SeasonRating {
	return {
		team,
		opr,
		parts: { auto: 0, hive: 0, flower: 0, garden: 0, park: 0, tips: 0 },
		matches: 10,
		events: 1,
		rank,
		percentile: 0.9,
		region: 'USAZ'
	};
}

function played(
	number: number,
	red: number[],
	blue: number[],
	at: string,
	redScore: number,
	blueScore: number
): Match {
	const base = match(number, red, blue, at, true);
	const score = (total: number) => ({ ...base.result!.red, total, preFoulTotal: total });
	return {
		...base,
		actualTime: Date.parse(at),
		result: {
			red: score(redScore),
			blue: score(blueScore),
			winner: redScore === blueScore ? null : redScore > blueScore ? 'red' : 'blue'
		}
	};
}

describe('team lists', () => {
	it('keeps valid unique team numbers up to the limit', () => {
		expect(parseTeamList('26670, 3747,abc,0,3747,-5,1234567')).toEqual([26670, 3747]);
		expect(parseTeamList(null)).toEqual([]);
		const many = Array.from({ length: 20 }, (_, index) => index + 1).join(',');
		expect(parseTeamList(many)).toHaveLength(MAX_FOLLOWED);
	});

	it('builds the same query for the same teams in any order', () => {
		expect(teamListQuery([3747, 26670, 3747])).toBe('3747,26670');
		expect(teamListQuery([26670, 3747])).toBe('3747,26670');
	});
});

describe('followedTeam', () => {
	it('uses the event running today and season ratings', () => {
		const season = teamSeason(26670, 'SCA Iron Eagles', [
			teamEvent({ code: 'OLD', start: '2026-10-10', end: '2026-10-10' }),
			{
				...teamEvent(),
				stats: {
					rank: 7,
					rs: 0,
					tbp: 0,
					avgTips: 0,
					wins: 3,
					losses: 1,
					ties: 0,
					dq: 0,
					played: 4,
					opr: { total: 0, auto: 0, teleop: 0 }
				}
			}
		]);
		expect(
			followedTeam(26670, season, { rating: rating(26670, 87.25, 42), rated: 3926 }, NOW)
		).toEqual({
			number: 26670,
			name: 'SCA Iron Eagles',
			found: true,
			event: {
				code: 'USAZGIQ',
				name: 'Roadrunner - Gilbert Qualifier',
				start: '2026-11-14',
				end: '2026-11-14',
				timezone: 'America/Phoenix',
				reason: 'today'
			},
			standing: { rank: 7, wins: 3, losses: 1, ties: 0 },
			opr: 87.25,
			worldRank: 42,
			rated: 3926
		});
	});

	it('falls back to the next event and FTCScout stats', () => {
		const season = {
			...teamSeason(3747, 'The Hive', [
				teamEvent({ code: 'NEXT', start: '2026-11-20', end: '2026-11-21' })
			]),
			quickStats: {
				season: 2026,
				total: { value: 50.5, rank: 300 },
				auto: { value: 0, rank: 0 },
				teleop: { value: 0, rank: 0 },
				endgame: { value: 0, rank: 0 },
				count: 5000
			}
		};
		expect(followedTeam(3747, season, { rating: null, rated: 0 }, NOW)).toMatchObject({
			event: { code: 'NEXT', reason: 'next' },
			standing: null,
			opr: 50.5,
			worldRank: 300,
			rated: 5000
		});
	});

	it('marks teams that could not be found', () => {
		expect(followedTeam(1, null, { rating: null, rated: 0 }, NOW)).toMatchObject({
			number: 1,
			found: false,
			event: null
		});
	});
});

describe('liveStatus', () => {
	const rankings = Array.from({ length: 27 }, (_, index) =>
		ranking(index + 1, index === 6 ? 26670 : 1000 + index, 3, 1)
	);

	it('shows rank, the next match with its time and the last result', () => {
		const bundle = followedBundle(
			[
				played(20, [26670, 1], [2, 3], '2026-11-14T19:00:00Z', 145, 98),
				played(21, [4, 5], [6, 7], '2026-11-14T19:07:00Z', 80, 90),
				match(22, [8, 9], [10, 11], '2026-11-14T19:14:00Z', false),
				match(26, [12, 13], [26670, 14], '2026-11-14T21:00:00Z', false)
			],
			rankings
		);
		const status = liveStatus(bundle, 26670, NOW);
		expect(status).toMatchObject({
			rank: 7,
			teams: 27,
			record: '3-1-0',
			note: null,
			next: { key: 'q26', label: 'Q26', side: 'blue' },
			last: { key: 'q20', label: 'Q20', outcome: 'W', own: 145, other: 98 }
		});
		expect(status.next?.when).toMatch(/PM$/);
	});

	it('names the day when the next match is not today', () => {
		const bundle = followedBundle(
			[match(1, [26670, 1], [2, 3], '2026-11-15T16:00:00Z', false)],
			rankings
		);
		const status = liveStatus(bundle, 26670, NOW);
		expect(status.next?.when).toMatch(/^Sun 9:00\sAM$/);
		expect(status.next?.estimated).toBe(false);
		expect(status.last).toBeNull();
	});

	it('explains when there is no next match', () => {
		expect(liveStatus(followedBundle([], []), 26670, NOW)).toMatchObject({
			rank: null,
			note: 'Schedule not posted'
		});
		const done = followedBundle(
			[played(1, [2, 3], [26670, 4], '2026-11-14T17:00:00Z', 50, 50)],
			rankings
		);
		expect(liveStatus(done, 26670, NOW)).toMatchObject({
			note: 'No matches left',
			last: { outcome: 'T', own: 50, other: 50 }
		});
		const elsewhere = followedBundle([match(1, [2, 3], [4, 5], '2026-11-14T21:00:00Z', false)], []);
		expect(liveStatus(elsewhere, 26670, NOW).note).toBe('Not in the schedule');
	});
});
