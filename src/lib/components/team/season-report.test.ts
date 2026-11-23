import { describe, expect, it } from 'vitest';
import type { Projection, SeasonRating } from '#lib/analysis/types.ts';
import type { Advancement, AllianceColor, Match, Team } from '#lib/types.ts';
import { eventSummary, match, teamEvent, teamSeason } from './fixtures.ts';
import {
	ALLY_LIMIT,
	advancementRows,
	allianceScores,
	allySummary,
	playedMatches,
	rpHabits,
	seasonTakeaways,
	upcomingEvents,
	upcomingEntries,
	type SeasonFacts
} from './season-report.ts';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const TEAM = 100;

const rp = (swarm: boolean, pollinator1 = false, pollinator2 = false) => ({
	swarm,
	pollinator1,
	pollinator2
});

function score(total: number, rpEarned: ReturnType<typeof rp> | null = null) {
	return {
		total,
		preFoulTotal: total,
		auto: 0,
		teleop: total,
		foulPoints: 0,
		breakdown: rpEarned ? ({ rp: rpEarned } as never) : null
	};
}

function played(
	number: number,
	red: number[],
	blue: number[],
	totals: [number, number],
	options: { rp?: [ReturnType<typeof rp>, ReturnType<typeof rp>]; level?: Match['level'] } = {}
): Match {
	const base = match(number, red, blue, '2026-11-14T16:00:00Z', false);
	const winner: AllianceColor | null =
		totals[0] === totals[1] ? null : totals[0] > totals[1] ? 'red' : 'blue';
	return {
		...base,
		level: options.level ?? 'qual',
		key: options.level === 'playoff' ? `p${number}` : base.key,
		result: {
			red: score(totals[0], options.rp?.[0] ?? null),
			blue: score(totals[1], options.rp?.[1] ?? null),
			winner
		}
	};
}

function team(number: number, name: string): Team {
	return {
		number,
		name,
		fullName: null,
		school: null,
		city: null,
		state: null,
		country: null,
		rookieYear: null
	};
}

function rating(number: number, opr: number): SeasonRating {
	return {
		team: number,
		opr,
		parts: { auto: 0, hive: 0, flower: 0, garden: 0, park: 0, tips: 0 },
		matches: 5,
		events: 1,
		rank: 0,
		percentile: 0,
		region: 'USAZ'
	};
}

const playedEvent = { ...teamEvent({ code: 'AAA', name: 'Alpha Qualifier' }) };

describe('played matches', () => {
	it('skips unplayed matches, surrogate seats and no-shows', () => {
		const surrogate = played(2, [TEAM, 1], [2, 3], [50, 40]);
		surrogate.red[0] = { ...surrogate.red[0], surrogate: true };
		const noShow = played(3, [TEAM, 1], [2, 3], [50, 40]);
		noShow.red[0] = { ...noShow.red[0], noShow: true };
		const season = teamSeason(TEAM, 'Us', [playedEvent]);
		const list = playedMatches(season, {
			AAA: {
				matches: [
					played(1, [TEAM, 1], [2, 3], [60, 40]),
					surrogate,
					noShow,
					match(4, [TEAM, 1], [2, 3], '2026-11-14T18:00:00Z', false)
				]
			}
		});
		expect(list.map((entry) => entry.match.key)).toEqual(['q1']);
		expect(allianceScores(list)).toEqual([60]);
	});
});

describe('partners and opponents', () => {
	const season = teamSeason(TEAM, 'Us', [playedEvent]);
	const bundles = {
		AAA: {
			teams: [team(1, 'One'), team(2, 'Two'), team(3, 'Three'), team(4, 'Four')],
			matches: [
				played(1, [TEAM, 1], [2, 3], [60, 40]),
				played(2, [4, TEAM], [1, 2], [30, 70]),
				played(3, [TEAM, 1], [3, 4], [90, 20]),
				played(4, [TEAM, 1], [2, 4], [50, 50], { level: 'playoff' })
			]
		}
	};

	it('counts matches and results with each partner and keeps the best score together', () => {
		const { partners, partnerCount } = allySummary(season, bundles, []);
		expect(partnerCount).toBe(2);
		expect(partners[0]).toMatchObject({
			team: 1,
			name: 'One',
			matches: 3,
			wins: 2,
			losses: 0,
			ties: 1,
			best: { code: 'AAA', key: 'q3', label: 'Q3', score: 90 }
		});
		expect(partners[1]).toMatchObject({ team: 4, matches: 1, losses: 1, best: { score: 30 } });
	});

	it('sorts opponents by season OPR, toughest first, with unrated teams last', () => {
		const pool = [rating(2, 40), rating(3, 80), rating(TEAM, 50)];
		const { opponents, opponentCount } = allySummary(season, bundles, pool);
		expect(opponentCount).toBe(4);
		expect(opponents.map((row) => row.team)).toEqual([3, 2, 4, 1]);
		expect(opponents[0]).toMatchObject({ opr: 80, rank: 1, matches: 2, wins: 2 });
		expect(opponents[1]).toMatchObject({ team: 2, matches: 3, wins: 1, losses: 1, ties: 1 });
		expect(opponents[3]).toMatchObject({ team: 1, opr: null, rank: null, losses: 1 });
	});

	it('sends only the top rows but reports the full count', () => {
		const many = Array.from({ length: 20 }, (_, index) =>
			played(index + 1, [TEAM, 1000 + index], [2000 + index, 3000 + index], [50, 40])
		);
		const result = allySummary(season, { AAA: { matches: many } }, []);
		expect(result.partners).toHaveLength(ALLY_LIMIT);
		expect(result.partnerCount).toBe(20);
		expect(result.opponentCount).toBe(40);
	});
});

describe('ranking point habits', () => {
	it('compares the team with every alliance at the same events', () => {
		const season = teamSeason(TEAM, 'Us', [playedEvent]);
		const matches = [
			played(1, [TEAM, 1], [2, 3], [60, 40], { rp: [rp(true, true), rp(false)] }),
			played(2, [TEAM, 1], [2, 3], [60, 40], { rp: [rp(true, true), rp(false)] }),
			played(3, [TEAM, 1], [2, 3], [60, 40], { rp: [rp(true), rp(false)] }),
			played(4, [4, 5], [2, 3], [60, 40], { rp: [rp(false), rp(false)] }),
			played(5, [TEAM, 1], [2, 3], [60, 40], { rp: [rp(true), rp(false)], level: 'playoff' })
		];
		const habits = rpHabits(playedMatches(season, { AAA: { matches } }), { AAA: { matches } });
		expect(habits?.played).toBe(3);
		const swarm = habits?.habits.find((entry) => entry.key === 'swarm');
		expect(swarm).toMatchObject({ earned: 3, event: 3 / 8 });
	});

	it('is empty without score breakdowns', () => {
		const season = teamSeason(TEAM, 'Us', [playedEvent]);
		const matches = [played(1, [TEAM, 1], [2, 3], [60, 40])];
		expect(rpHabits(playedMatches(season, { AAA: { matches } }), { AAA: { matches } })).toBeNull();
	});
});

describe('advancement', () => {
	function advancement(overrides: Partial<Advancement> = {}): Advancement {
		return {
			advancesTo: 'USAZCMP',
			advancesToName: 'Arizona Championship',
			slots: 4,
			fcmpReserved: 0,
			teams: [{ slot: 1, team: TEAM, criteria: 'Inspire', declined: false, status: 'first' }],
			...overrides
		};
	}

	it('names the championship and the event the team advanced from, once', () => {
		const season = teamSeason(TEAM, 'Us', [
			playedEvent,
			teamEvent({ code: 'BBB', name: 'Beta Qualifier' })
		]);
		const rows = advancementRows(season, {
			AAA: { matches: [], advancement: advancement() },
			BBB: { matches: [], advancement: advancement() }
		});
		expect(rows).toEqual([
			{ code: 'AAA', event: 'Alpha Qualifier', to: 'Arizona Championship', toCode: 'USAZCMP' }
		]);
	});

	it('skips declined, ineligible and already advancing slots', () => {
		const season = teamSeason(TEAM, 'Us', [playedEvent]);
		for (const slot of [
			{ declined: true, status: 'first' as const },
			{ declined: false, status: 'ineligible' as const },
			{ declined: false, status: 'already-advancing' as const }
		]) {
			const teams = [{ slot: 1, team: TEAM, criteria: null, ...slot }];
			expect(
				advancementRows(season, { AAA: { matches: [], advancement: advancement({ teams }) } })
			).toEqual([]);
		}
	});
});

describe('upcoming events', () => {
	const next = teamEvent({
		code: 'NEXT',
		name: 'Next Qualifier',
		start: '2026-12-05',
		end: '2026-12-05'
	});
	const later = teamEvent({ code: 'LATER', start: '2027-01-09', end: '2027-01-09' });
	const season = teamSeason(TEAM, 'Us', [later, playedEvent, next]);
	const pool = [rating(TEAM, 50), rating(1, 70), rating(2, 30), rating(3, 90)];

	it('keeps the next few events that have not finished, in date order', () => {
		expect(upcomingEntries(season, NOW).map(({ event }) => event.code)).toEqual(['NEXT', 'LATER']);
	});

	it('uses the ranking simulation when there is a schedule', () => {
		const projections = [TEAM, 1, 2].map((number, index): Projection => ({
			team: number,
			rankChances: [],
			top4: 0.5,
			top8: 0.9,
			expectedRs: 2,
			expectedRank: index + 1.4
		}));
		const rows = upcomingEvents(
			season,
			{ NEXT: { matches: [], teams: [team(TEAM, 'Us'), team(1, 'One'), team(2, 'Two')] } },
			{ NEXT: { projections } },
			pool,
			NOW
		);
		expect(rows[0]).toMatchObject({
			code: 'NEXT',
			kind: 'projection',
			registered: 3,
			live: false,
			outlook: 'Expected rank 1 of 3'
		});
	});

	it('mentions the top 8 chance only in fields larger than 8', () => {
		const projections = Array.from({ length: 12 }, (_, index): Projection => ({
			team: index === 0 ? TEAM : index,
			rankChances: [],
			top4: 0.2,
			top8: 0.71,
			expectedRs: 2,
			expectedRank: index + 4
		}));
		const [row] = upcomingEvents(
			season,
			{ NEXT: { matches: [] } },
			{ NEXT: { projections } },
			pool,
			NOW
		);
		expect(row.outlook).toBe('Expected rank 4 of 12, 71% chance of top 8');
	});

	it('orders registered teams by season OPR before a schedule is out', () => {
		const teams = [team(TEAM, 'Us'), team(1, 'One'), team(2, 'Two'), team(9, 'New')];
		const [row, second] = upcomingEvents(season, { NEXT: { matches: [], teams } }, {}, pool, NOW);
		expect(row).toMatchObject({
			kind: 'opr',
			registered: 4,
			outlook: '2nd of 3 rated teams by season OPR'
		});
		expect(second).toMatchObject({
			code: 'LATER',
			kind: 'none',
			registered: null,
			outlook: 'Team list not out yet'
		});
	});

	it('says when the team has no season OPR yet', () => {
		const teams = [team(TEAM, 'Us'), team(1, 'One'), team(2, 'Two')];
		const [row] = upcomingEvents(season, { NEXT: { matches: [], teams } }, {}, [], NOW);
		expect(row).toMatchObject({ kind: 'none', outlook: 'No season OPR yet' });
	});

	it('marks an event that is under way', () => {
		const live = teamSeason(TEAM, 'Us', [
			{
				event: eventSummary({ code: 'LIVE', start: '2026-11-19', end: '2026-11-20' }),
				stats: null,
				awards: []
			}
		]);
		expect(upcomingEvents(live, {}, {}, pool, NOW)[0]).toMatchObject({ live: true });
	});
});

describe('season takeaways', () => {
	function facts(overrides: Partial<SeasonFacts> = {}): SeasonFacts {
		return {
			stats: {
				rank: 40,
				of: 4000,
				events: 2,
				record: { wins: 8, losses: 2, ties: 0 },
				region: { code: 'USAZ', rank: 1, of: 120 }
			},
			comparison: [
				{ key: 'total', value: 120, percentile: 99 },
				{ key: 'auto', value: 30, percentile: 97 },
				{ key: 'teleop', value: 90, percentile: 99 },
				{ key: 'hive', value: 70, percentile: 98 },
				{ key: 'garden', value: 0.3, percentile: 99 }
			],
			trend: [
				{ label: 'A', value: 80 },
				{ label: 'B', value: 120 }
			],
			advancement: [],
			rookie: false,
			scores: [],
			rp: null,
			...overrides
		};
	}

	it('leads with advancement, then standing and strengths, at most four lines', () => {
		const lines = seasonTakeaways(
			facts({
				advancement: [
					{ code: 'AAA', event: 'Alpha Qualifier', to: 'Arizona Championship', toCode: 'USAZCMP' }
				]
			})
		);
		expect(lines).toEqual([
			'Advanced to Arizona Championship from Alpha Qualifier',
			'Top 1% worldwide by season OPR, best in Arizona',
			'Strongest at hive scoring, better than 98% of teams',
			'OPR rose from 80.0 to 120.0 over 2 events'
		]);
	});

	it('ignores tiny parts and reports the trend across events', () => {
		const lines = seasonTakeaways(facts({ stats: { ...facts().stats, rank: 900, region: null } }));
		expect(lines).toEqual([
			'Strongest at hive scoring, better than 98% of teams',
			'OPR rose from 80.0 to 120.0 over 2 events'
		]);
	});

	it('notes consistent and uneven scoring', () => {
		const quiet = {
			stats: { ...facts().stats, rank: 900, region: null },
			comparison: [],
			trend: []
		};
		expect(seasonTakeaways(facts({ ...quiet, scores: [60, 62, 58, 61, 59, 90] }))).toContain(
			'Consistent: 5 of 6 alliance scores within 10 points of the 65 average'
		);
		expect(seasonTakeaways(facts({ ...quiet, scores: [20, 90, 30, 100, 25, 95] }))).toContain(
			'Uneven scores: from 20 to 100 across 6 matches'
		);
	});

	it('does not repeat the stats row when little stands out', () => {
		const lines = seasonTakeaways(
			facts({
				stats: {
					rank: 2000,
					of: 4000,
					events: 1,
					record: { wins: 3, losses: 2, ties: 0 },
					region: null
				},
				comparison: [],
				trend: []
			})
		);
		expect(lines).toEqual([]);
	});

	it('says nothing for a team that has not played, since the sections below cover it', () => {
		const empty = { rank: null, of: null, events: 0, record: null, region: null };
		expect(seasonTakeaways(facts({ stats: empty }))).toEqual([]);
		expect(seasonTakeaways(facts({ stats: empty, rookie: true }))).toEqual([]);
	});

	it('mentions a rookie season when a rookie advances', () => {
		const [line] = seasonTakeaways(
			facts({
				rookie: true,
				advancement: [{ code: 'AAA', event: 'Alpha Qualifier', to: null, toCode: null }]
			})
		);
		expect(line).toBe('Advanced to the next level from Alpha Qualifier in its rookie season');
	});
});
