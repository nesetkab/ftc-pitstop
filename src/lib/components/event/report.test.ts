import { describe, expect, it } from 'vitest';
import type {
	EventAnalysis,
	MatchForecast,
	RatingParts,
	SeasonRating,
	TeamRating
} from '#lib/analysis/types.ts';
import type { AllianceScore, EventBundle, Match, MatchTeam } from '#lib/types.ts';
import { createReporter, takeaways, type ReportInput, type TeamReport } from './report.ts';
import { fakeAnalysis, fixtureBundle } from './test-fixtures.ts';

type Rp = { swarm?: boolean; pollinator1?: boolean; pollinator2?: boolean };

const NONE: RatingParts = { auto: 0, hive: 0, flower: 0, garden: 0, park: 0, tips: 0 };

function score(total: number, rp: Rp = {}): AllianceScore {
	return {
		total,
		preFoulTotal: total,
		auto: 0,
		teleop: total,
		foulPoints: 0,
		breakdown: {
			auto: { leave: [false, false], park: [false, false], tips: 0 },
			teleop: {
				tips: 0,
				cellBalls: 0,
				flowers: { red: [], blue: [], scoring: [], audience: [] },
				gardenBalls: 0,
				park: [false, false]
			},
			points: {
				autoLeave: 0,
				autoPark: 0,
				autoHive: 0,
				auto: 0,
				teleopHive: 0,
				teleopFlower: 0,
				teleopGarden: 0,
				teleopPark: 0,
				teleop: total
			},
			minorFouls: 0,
			majorFouls: 0,
			foulPointsCommitted: 0,
			rp: { swarm: false, pollinator1: false, pollinator2: false, ...rp }
		}
	};
}

function seat(team: number, station: number, flags: Partial<MatchTeam> = {}): MatchTeam {
	return { team, station, surrogate: false, noShow: false, dq: false, onField: true, ...flags };
}

type Side = { teams: (number | MatchTeam)[]; score?: number; rp?: Rp };

function match(number: number, red: Side, blue: Side, level: Match['level'] = 'qual'): Match {
	const seats = (side: Side) =>
		side.teams.map((team, index) => (typeof team === 'number' ? seat(team, index + 1) : team));
	const played = red.score !== undefined && blue.score !== undefined;
	const redScore = red.score ?? 0;
	const blueScore = blue.score ?? 0;
	const prefix = level === 'qual' ? 'q' : 'p';
	return {
		key: `${prefix}${number}`,
		level,
		series: 0,
		number,
		label: `${level === 'qual' ? 'Q' : 'M'}${number}`,
		description: `Qualification ${number}`,
		scheduledTime: Date.parse('2026-11-21T15:00:00Z') + number * 360_000,
		actualTime: null,
		postedTime: null,
		red: seats(red),
		blue: seats(blue),
		result: played
			? {
					red: score(redScore, red.rp),
					blue: score(blueScore, blue.rp),
					winner: redScore > blueScore ? 'red' : redScore < blueScore ? 'blue' : null
				}
			: null
	};
}

function bundle(
	matches: Match[],
	teams: number[],
	type: EventBundle['event']['type'] = 'Qualifier'
) {
	const base = fixtureBundle('USMTBUQ-final');
	return {
		event: { ...base.event, type },
		teams: teams.map((number) => ({ ...base.teams[0], number, name: `Team ${number}` })),
		matches,
		rankings: []
	};
}

function rating(team: number, opr: number, parts: Partial<RatingParts> = {}): TeamRating {
	return { team, opr, parts: { ...NONE, ...parts }, matches: 5, rank: 0, prior: opr, history: [] };
}

function analysis(
	ratings: TeamRating[],
	forecasts: Record<string, MatchForecast> = {}
): ReportInput['analysis'] {
	return {
		ratings,
		forecasts,
		timing: { cycleSeconds: null, delaySeconds: null, onField: null, next: null, matches: {} }
	};
}

function seasonRating(team: number, opr: number, parts: Partial<RatingParts> = {}): SeasonRating {
	return {
		team,
		opr,
		parts: { ...NONE, ...parts },
		matches: 10,
		events: 2,
		rank: 40,
		percentile: 0.9,
		region: null
	};
}

function forecast(key: string, redWin: number): MatchForecast {
	const rp = { win: 0, tie: 0, swarm: 0, pollinator1: 0, pollinator2: 0, expected: 0 };
	return {
		key,
		red: { score: 80, sd: 10, win: redWin, rp },
		blue: { score: 60, sd: 10, win: 1 - redWin, rp },
		tie: 0,
		played: false,
		correct: null
	};
}

const TEAMS = [1, 2, 3, 4, 5, 6, 7, 8];

function reportOf(input: Partial<ReportInput> & Pick<ReportInput, 'bundle'>, team: number) {
	return createReporter({ analysis: null, season: null, seasonCount: null, ...input })(team);
}

describe('scouting report stats', () => {
	const matches = [
		match(1, { teams: [1, 2], score: 60, rp: { swarm: true } }, { teams: [3, 4], score: 40 }),
		match(2, { teams: [5, 6], score: 50 }, { teams: [1, 7], score: 90, rp: { pollinator1: true } }),
		match(
			3,
			{ teams: [seat(1, 1, { noShow: true }), seat(8, 2)], score: 10 },
			{ teams: [2, 3], score: 30 }
		),
		match(
			4,
			{ teams: [seat(1, 1, { surrogate: true }), seat(4, 2)], score: 30, rp: { swarm: true } },
			{
				teams: [5, 6],
				score: 70
			}
		),
		match(5, { teams: [1, 3] }, { teams: [5, 8] })
	];
	const input = { bundle: bundle(matches, TEAMS) };

	it('summarizes alliance scores, skipping no-shows but keeping surrogate matches', () => {
		const report = reportOf(input, 1)!;
		expect(report.played.map((entry) => entry.key)).toEqual(['q1', 'q2', 'q4']);
		expect(report.spread).toMatchObject({
			count: 3,
			average: 60,
			best: { key: 'q2', score: 90 },
			worst: { key: 'q4', score: 30 }
		});
		expect(report.spread?.sd).toBeCloseTo(Math.sqrt(600));
		expect(report.played[1]).toMatchObject({
			alliance: 'blue',
			result: 'win',
			partners: [7],
			opponents: [5, 6]
		});
	});

	it('counts ranking points in qualification matches the team played for itself', () => {
		const report = reportOf(input, 1)!;
		expect(report.rp?.played).toBe(2);
		const earned = Object.fromEntries(report.rp!.habits.map((h) => [h.key, h.earned]));
		expect(earned).toEqual({ swarm: 1, pollinator1: 1, pollinator2: 0 });
		const swarm = report.rp!.habits.find((h) => h.key === 'swarm')!;
		expect(swarm.event).toBeCloseTo(2 / 8);
	});

	it('lists remaining matches with partners, opponents and win chances', () => {
		const report = reportOf({ ...input, analysis: analysis([], { q5: forecast('q5', 0.7) }) }, 1)!;
		expect(report.upcoming).toEqual([
			{
				key: 'q5',
				label: 'Q5',
				time: matches[4].scheduledTime,
				alliance: 'red',
				partners: [3],
				opponents: [5, 8],
				win: 0.7,
				score: 80,
				opponentScore: 60
			}
		]);
		expect(reportOf(input, 8)!.upcoming[0]).toMatchObject({ alliance: 'blue', win: null });
	});

	it('returns null for a team that is not at the event', () => {
		expect(reportOf(input, 99)).toBeNull();
	});

	it('reads the trend from qualification matches only', () => {
		const scores = [90, 95, 100, 92, 98, 50, 55, 45];
		const long = scores.map((value, index) =>
			match(index + 1, { teams: [1, 2], score: value }, { teams: [3, 4], score: 40 })
		);
		long.push(match(9, { teams: [1, 2], score: 200 }, { teams: [3, 4], score: 40 }, 'playoff'));
		const report = reportOf({ bundle: bundle(long, TEAMS) }, 1)!;
		expect(report.trend).toMatchObject({ firstCount: 4, secondCount: 4 });
		expect(report.trend?.first).toBeCloseTo(94.25);
		expect(report.trend?.second).toBeCloseTo(62);
		expect(report.trend?.recent).toEqual({ average: 50, before: 95 });
		expect(report.takeaways).toContain(
			'Scores dropped in the last 3 matches: 50 average vs 95 before'
		);
	});
});

describe('scouting report parts', () => {
	const matches = TEAMS.filter((team) => team % 2 === 1).map((team) =>
		match(team, { teams: [team, team + 1], score: 50 }, { teams: [9, 10], score: 40 })
	);
	const ratings = [
		rating(1, 80, { auto: 30, hive: 30, park: 10 }),
		...[2, 3, 4, 5, 6, 7, 8].map((team) => rating(team, 40 - team, { auto: 5, hive: 20, park: 8 })),
		rating(77, 200, { auto: 90 })
	];

	it('ranks parts among teams that played here and compares with the season', () => {
		const report = reportOf(
			{
				bundle: bundle(matches, TEAMS),
				analysis: analysis(ratings),
				season: [seasonRating(1, 70, { auto: 25 })],
				seasonCount: 4000
			},
			1
		)!;
		const auto = report.parts?.find((row) => row.key === 'auto');
		const teleop = report.parts?.find((row) => row.key === 'teleop');
		expect(report.rated).toBe('here');
		expect(auto).toMatchObject({ value: 30, rank: 1, of: 8, season: 25 });
		expect(auto?.average).toBeCloseTo((30 + 5 * 7) / 8);
		expect(teleop).toMatchObject({ value: 50, season: 45 });
		expect(report.season).toEqual({ opr: 70, rank: 40, of: 4000 });
	});

	it('uses season form before the event starts', () => {
		const upcoming = matches.map((entry) => ({ ...entry, result: null }));
		const report = reportOf({ bundle: bundle(upcoming, TEAMS), analysis: analysis(ratings) }, 1)!;
		expect(report.rated).toBe('expected');
		expect(report.parts?.find((row) => row.key === 'opr')?.of).toBe(8);
		expect(report.takeaways[0]).toBe('Top OPR: 1st of 8 by season form');
	});

	it('works without an analysis', () => {
		const report = reportOf({ bundle: bundle(matches, TEAMS) }, 1)!;
		expect(report.parts).toBeNull();
		expect(report.rated).toBeNull();
	});
});

describe('scouting report takeaways', () => {
	function base(overrides: Partial<TeamReport> = {}): Omit<TeamReport, 'takeaways'> {
		return {
			team: 1,
			name: 'Team 1',
			ranking: null,
			rankedOf: 0,
			league: false,
			rated: 'here',
			parts: null,
			season: null,
			played: [],
			spread: null,
			rp: null,
			trend: null,
			upcoming: [],
			eventStarted: true,
			scale: 100,
			eventAverage: 50,
			...overrides
		};
	}

	const played = (count: number) =>
		Array.from({ length: count }, (_, index) => ({
			key: `q${index + 1}`,
			label: `Q${index + 1}`,
			level: 'qual' as const,
			alliance: 'red' as const,
			score: 54,
			opponentScore: 40,
			result: 'win' as const,
			partners: [2],
			opponents: [3, 4],
			surrogate: false,
			dq: false,
			rp: { swarm: false, pollinator1: false, pollinator2: false }
		}));

	const part = (key: 'opr' | 'auto' | 'park', value: number, rank: number) => ({
		key,
		label: key,
		value,
		average: 10,
		rank,
		of: 31,
		season: null
	});

	it('names standout parts and rare ranking points, at most four', () => {
		const lines = takeaways(
			base({
				played: played(6),
				parts: [part('opr', 90, 1), part('auto', 30, 2), part('park', 1, 31)],
				rp: {
					played: 6,
					habits: [
						{ key: 'swarm', label: 'Swarm', earned: 1, event: 0.5 },
						{ key: 'pollinator1', label: 'Pollinator 1', earned: 0, event: 0.4 },
						{ key: 'pollinator2', label: 'Pollinator 2', earned: 0, event: 0.1 }
					]
				},
				trend: { first: 50, second: 80, firstCount: 3, secondCount: 3, recent: null }
			})
		);
		expect(lines).toHaveLength(4);
		expect(lines.slice(0, 2)).toEqual([
			'Top OPR: 1st of 31 at this event',
			'Strong autonomous: 2nd of 31 at this event'
		]);
		expect(lines).toContain('Rarely earns Pollinator: 0 of 6 matches');
		for (const line of lines) expect(line).toMatch(/^[\w\s:;,.\-'']+$/);
	});

	it('does not call out a habit most alliances share', () => {
		const lines = takeaways(
			base({
				played: played(5),
				rp: {
					played: 5,
					habits: [
						{ key: 'swarm', label: 'Swarm', earned: 5, event: 0.8 },
						{ key: 'pollinator1', label: 'Pollinator 1', earned: 1, event: 0.05 },
						{ key: 'pollinator2', label: 'Pollinator 2', earned: 0, event: 0 }
					]
				}
			})
		);
		expect(lines.join(' ')).not.toMatch(/Swarm|Pollinator/);
	});

	it('handles a team with one match', () => {
		const lines = takeaways(
			base({
				played: played(1),
				parts: [part('opr', 90, 1), part('auto', 30, 1)],
				ranking: {
					rank: 3,
					team: 1,
					rs: 4,
					tbp: 54,
					avgTips: 0,
					avgAuto: 0,
					wins: 1,
					losses: 0,
					ties: 0,
					played: 1,
					dq: 0
				},
				rankedOf: 20
			})
		);
		expect(lines).toEqual([
			'One match played so far: alliance scored 54 in Q1',
			'Ranked 3rd of 20, record 1-0-0'
		]);
	});

	it('says when a team did not play', () => {
		expect(takeaways(base())).toEqual(['Did not play a match at this event']);
		const next = takeaways(
			base({
				upcoming: [
					{
						key: 'q9',
						label: 'Q9',
						time: null,
						alliance: 'red',
						partners: [],
						opponents: [],
						win: null,
						score: null,
						opponentScore: null
					}
				]
			})
		);
		expect(next[0]).toBe('No matches played here yet; first is Q9');
	});

	it('falls back to season form before the event', () => {
		expect(
			takeaways(
				base({ eventStarted: false, rated: null, season: { opr: 61.8, rank: 197, of: 3981 } })
			)
		).toEqual(['Season OPR 61.8: 197th of 3,981 worldwide']);
	});

	it('mentions favored remaining matches', () => {
		const upcoming = [0.8, 0.7].map((win, index) => ({
			key: `q${index + 9}`,
			label: `Q${index + 9}`,
			time: null,
			alliance: 'red' as const,
			partners: [],
			opponents: [],
			win,
			score: null,
			opponentScore: null
		}));
		expect(takeaways(base({ played: played(4), upcoming }))).toContain(
			'Favored in all 2 remaining matches'
		);
	});
});

describe('scouting reports on recorded events', () => {
	it('ranks league meet teams only against teams at the meet', () => {
		const meet = fixtureBundle('USMIWMM8');
		const report = createReporter({
			bundle: meet,
			analysis: fakeAnalysis(meet) as EventAnalysis,
			season: null,
			seasonCount: null
		});
		const here = meet.teams[0].number;
		const result = report(here)!;
		expect(result.league).toBe(true);
		expect(result.parts?.[0].of).toBeLessThanOrEqual(meet.teams.length);
		expect(meet.rankings.length).toBeGreaterThan(meet.teams.length);
		expect(result.takeaways.length).toBeGreaterThan(0);
	});

	it('builds a report for every team at a finished qualifier', () => {
		const event = fixtureBundle('KZASQ1');
		const report = createReporter({
			bundle: event,
			analysis: fakeAnalysis(event),
			season: null,
			seasonCount: null
		});
		for (const team of event.teams) {
			const result = report(team.number)!;
			expect(result.takeaways.length).toBeGreaterThan(0);
			expect(result.takeaways.length).toBeLessThanOrEqual(4);
		}
	});
});
