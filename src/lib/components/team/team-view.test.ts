import { beforeAll, describe, expect, it } from 'vitest';
import type { EventAnalysis, SeasonRating, SeasonRatings } from '#lib/analysis/types.ts';
import type { EventBundle, TeamSeason } from '#lib/types.ts';
import { fixtureLoaders, scoutTeamSeason } from './fixtures.server.ts';
import { teamEvent, teamSeason } from './fixtures.ts';
import {
	awardLabel,
	buildTeamPage,
	eventBreakdown,
	percentileOf,
	ratedTeams,
	rankPercentile,
	regionStanding,
	seasonTrend
} from './team-view.ts';

const NOW = Date.parse('2026-11-19T12:00:00Z');

let season: TeamSeason;
let bundle: EventBundle;

beforeAll(async () => {
	season = await scoutTeamSeason('team-2844', 2844);
	bundle = await fixtureLoaders().loadEventBundle('USAZGIQ');
});

const parts = { auto: 0, hive: 0, flower: 0, garden: 0, park: 0, tips: 0 };

function rating(team: number, opr: number, overrides: Partial<SeasonRating> = {}): SeasonRating {
	return {
		team,
		opr,
		parts: { ...parts, auto: opr / 4, hive: opr / 2, park: opr / 8, tips: opr / 20 },
		matches: 8,
		events: 1,
		rank: 0,
		percentile: 0,
		region: 'USAZ',
		...overrides
	};
}

function ratings(teams: SeasonRating[]): SeasonRatings {
	return { generatedAt: NOW, teams };
}

function analysis(team: number, keys: string[]): EventAnalysis {
	return {
		code: 'USAZGIQ',
		generatedAt: NOW,
		model: { id: 'opr-map', label: 'OPR' },
		ratings: [
			{
				team,
				opr: 40,
				parts,
				matches: keys.length,
				rank: 1,
				prior: 30,
				history: keys.map((key, index) => ({ key, time: index + 1, opr: 30 + index * 2 }))
			}
		],
		forecasts: {},
		timing: { cycleSeconds: null, delaySeconds: null, onField: null, next: null, matches: {} },
		projections: null,
		strength: [],
		playoffs: null,
		picks: null,
		averages: { parts, score: 0, matches: 0 }
	};
}

describe('percentiles', () => {
	it('counts the share of teams with a lower value', () => {
		expect(percentileOf([10, 20, 30, 40], 30)).toBe(50);
		expect(percentileOf([10, 20, 30, 40], 40)).toBe(75);
		expect(percentileOf([10, 20, 30, 40], 5)).toBe(0);
		expect(percentileOf([], 5)).toBeNull();
	});

	it('turns a rank into a percentile and never reaches 100', () => {
		expect(rankPercentile(214, 3272)).toBe(93);
		expect(rankPercentile(608, 3272)).toBe(81);
		expect(rankPercentile(1, 3272)).toBe(99);
		expect(rankPercentile(0, 3272)).toBeNull();
		expect(rankPercentile(5, 0)).toBeNull();
	});
});

describe('buildTeamPage without season ratings', () => {
	it('uses the FTCScout numbers for the stats row', () => {
		const view = buildTeamPage({ season, ratings: null, analyses: {}, bundles: {}, now: NOW });
		expect(view.source).toBe('scout');
		expect(view.team).toEqual({
			number: 2844,
			name: 'Valley X Robotics',
			place: 'Chandler, Arizona',
			rookieYear: 2008
		});
		expect(view.stats.opr).toBeCloseTo(47.3615, 3);
		expect(view.stats).toMatchObject({
			rank: 345,
			of: 3272,
			record: { wins: 2, losses: 3, ties: 0 },
			events: 1
		});
	});

	it('compares the team using FTCScout ranks', () => {
		const view = buildTeamPage({ season, ratings: null, analyses: {}, bundles: {}, now: NOW });
		expect(view.comparison.map((row) => [row.label, row.percentile])).toEqual([
			['Total', 89],
			['Auto', 96],
			['Teleop', 75]
		]);
	});

	it('draws one aOPR point per event', () => {
		const view = buildTeamPage({ season, ratings: null, analyses: {}, bundles: {}, now: NOW });
		expect(view.chartTitle).toBe('aOPR at each event');
		expect(view.charts).toHaveLength(1);
		expect(view.charts[0].points).toEqual([{ label: 'Nov 14', value: expect.any(Number) }]);
		expect(view.charts[0].points[0].value).toBeCloseTo(47.3615, 3);
	});

	it('lists the event and its award with no playoff text without a bundle', () => {
		const view = buildTeamPage({ season, ratings: null, analyses: {}, bundles: {}, now: NOW });
		expect(view.events).toEqual([
			{
				code: 'USAZGIQ',
				name: 'Roadrunner - Gilbert Qualifier',
				start: '2026-11-14',
				end: '2026-11-14',
				rank: 16,
				record: { wins: 2, losses: 3, ties: 0 },
				opr: expect.any(Number),
				playoffs: null
			}
		]);
		expect(view.awards).toEqual([
			{
				code: 'USAZGIQ',
				event: 'Roadrunner - Gilbert Qualifier',
				name: 'Inspire Award 3rd place'
			}
		]);
	});

	it('shows banners only for inspire and the winning alliance at championships', () => {
		const award = (id: number, name: string, placement = 1) => ({
			id,
			name,
			placement,
			team: 2844,
			person: null
		});
		const withChampionship = {
			...season,
			events: [
				...season.events,
				{
					...teamEvent({
						code: 'USAZCMP',
						name: 'Arizona Championship',
						type: 'Championship',
						start: '2027-02-20'
					}),
					awards: [award(13, 'Winning Alliance'), award(4, 'Control Award')]
				}
			]
		};
		const history = [
			{
				season: 2023,
				code: 'USUTCMP',
				event: 'Utah Championship',
				start: '2024-02-10',
				award: award(13, 'Winning Alliance')
			},
			{
				season: 2025,
				code: 'USUTCMP',
				event: 'Utah Championship',
				start: '2026-02-21',
				award: award(11, 'Inspire Award')
			},
			{
				season: 2026,
				code: 'USAZCMP',
				event: 'Repeat',
				start: '2027-02-20',
				award: award(11, 'Inspire Award')
			}
		];
		const view = buildTeamPage({
			season: withChampionship,
			history,
			ratings: null,
			analyses: {},
			bundles: {},
			now: NOW
		});
		expect(view.banners).toEqual([
			{
				season: '2026-27',
				award: 'Winner',
				event: 'Arizona Championship',
				code: 'USAZCMP'
			},
			{ season: '2025-26', award: 'Inspire', event: 'Utah Championship', code: null },
			{ season: '2023-24', award: 'Winner', event: 'Utah Championship', code: null }
		]);
		expect(view.awards.map((entry) => entry.name)).toEqual([
			'Inspire Award 3rd place',
			'Winning alliance',
			'Control Award'
		]);
	});

	it('summarizes last season', () => {
		const view = buildTeamPage({ season, ratings: null, analyses: {}, bundles: {}, now: NOW });
		expect(view.previous).toMatchObject({ season: 2025, game: 'DECODE', count: 8368 });
		expect(view.previous?.rows.map((row) => [row.label, row.rank])).toEqual([
			['Total', 1689],
			['Auto', 1555],
			['Teleop', 1806],
			['Endgame', 371]
		]);
	});

	it('handles a team with no results yet', () => {
		const empty: TeamSeason = {
			...season,
			events: season.events.map((entry) => ({ ...entry, stats: null, awards: [] })),
			quickStats: null,
			previousQuickStats: null
		};
		const view = buildTeamPage({
			season: empty,
			ratings: null,
			analyses: {},
			bundles: {},
			now: NOW
		});
		expect(view.stats).toEqual({
			opr: null,
			rank: null,
			of: null,
			record: null,
			events: 0,
			region: null
		});
		expect(view.charts).toEqual([]);
		expect(view.comparison).toEqual([]);
		expect(view.previous).toBeNull();
		expect(view.events[0].playoffs).toBe("Didn't play");
		const unposted = buildTeamPage({
			season: {
				...empty,
				events: empty.events.map((entry) => ({
					...entry,
					event: { ...entry.event, hasMatches: false }
				}))
			},
			ratings: null,
			analyses: {},
			bundles: {},
			now: NOW
		});
		expect(unposted.events[0].playoffs).toBe('No results');
	});

	it('leaves events still to come to the coming up list and labels running ones', () => {
		const entry = season.events[0];
		const base = { ...season, quickStats: null, previousQuickStats: null };
		const before = buildTeamPage({
			season: { ...base, events: [{ ...entry, stats: null, awards: [] }] },
			ratings: null,
			analyses: {},
			bundles: {},
			now: Date.parse('2026-11-10T12:00:00Z')
		});
		expect(before.upcoming.map((row) => row.code)).toEqual([entry.event.code]);
		expect(before.events).toEqual([]);
		const during = buildTeamPage({
			season: { ...base, events: [{ ...entry, stats: null, awards: [] }] },
			ratings: null,
			analyses: {},
			bundles: {},
			now: Date.parse('2026-11-14T20:00:00Z')
		});
		expect(during.events[0].playoffs).toBe('In progress');
	});
});

describe('buildTeamPage with season ratings', () => {
	const pool = ratings([
		rating(111, 80),
		rating(222, 60),
		rating(2844, 50),
		rating(333, 40),
		rating(444, 20),
		rating(555, 99, { matches: 0 })
	]);

	it('ranks the team among teams that have played', () => {
		const view = buildTeamPage({ season, ratings: pool, analyses: {}, bundles: {}, now: NOW });
		expect(view.source).toBe('ratings');
		expect(view.stats).toMatchObject({ opr: 50, rank: 3, of: 5 });
		expect(ratedTeams(pool)).toHaveLength(5);
	});

	it('gives percentiles for every part', () => {
		const view = buildTeamPage({ season, ratings: pool, analyses: {}, bundles: {}, now: NOW });
		expect(view.comparison.map((row) => row.key)).toEqual([
			'total',
			'auto',
			'teleop',
			'hive',
			'flower',
			'garden',
			'park',
			'tips'
		]);
		const total = view.comparison.find((row) => row.key === 'total');
		expect(total).toMatchObject({ value: 50, percentile: 40, nested: false });
		const teleop = view.comparison.find((row) => row.key === 'teleop');
		expect(teleop?.value).toBeCloseTo(37.5, 5);
		expect(view.comparison.find((row) => row.key === 'hive')?.nested).toBe(true);
	});

	it('charts aOPR after each match and marks where playoffs start', () => {
		const view = buildTeamPage({
			season,
			ratings: pool,
			analyses: { USAZGIQ: analysis(2844, ['q3', 'q9', 'p1', 'p3']) },
			bundles: {},
			now: NOW
		});
		expect(view.chartTitle).toBe('aOPR after each match');
		expect(view.charts).toHaveLength(1);
		expect(view.charts[0]).toMatchObject({
			id: 'USAZGIQ',
			title: 'Roadrunner - Gilbert Qualifier',
			divider: { after: 1, label: 'Playoffs' }
		});
		expect(view.charts[0].points.map((point) => point.label)).toEqual(['Q3', 'Q9', 'M1', 'M3']);
		expect(view.charts[0].points.map((point) => point.value)).toEqual([30, 32, 34, 36]);
		expect(view.events.find((event) => event.code === 'USAZGIQ')?.opr).toBe(40);
	});

	it('leaves the divider out when there are no playoff matches', () => {
		const view = buildTeamPage({
			season,
			ratings: pool,
			analyses: { USAZGIQ: analysis(2844, ['q1', 'q2']) },
			bundles: {},
			now: NOW
		});
		expect(view.charts[0].divider).toBeNull();
	});

	it('falls back to event points when analysis has no rating for the team', () => {
		const view = buildTeamPage({
			season,
			ratings: pool,
			analyses: { USAZGIQ: analysis(9999, ['q1', 'q2']) },
			bundles: {},
			now: NOW
		});
		expect(view.chartTitle).toBe('aOPR at each event');
	});

	it('ranks a tie on aOPR the same way the leaderboard lists it', () => {
		const tied = ratings([rating(111, 80), rating(9000, 50), rating(2844, 50), rating(100, 50)]);
		const view = buildTeamPage({ season, ratings: tied, analyses: {}, bundles: {}, now: NOW });
		expect(view.stats).toMatchObject({ rank: 3, of: 4, region: { rank: 3, of: 4 } });
	});

	it('shows the official FIRST rank for an event instead of the FTCScout one', () => {
		const scoutRank = season.events.find((entry) => entry.event.code === 'USAZGIQ')?.stats?.rank;
		const official = {
			...bundle,
			rankings: bundle.rankings.map((row) =>
				row.team === 2844 ? { ...row, rank: 99, wins: 1, losses: 2, ties: 3 } : row
			)
		};
		const view = buildTeamPage({
			season,
			ratings: pool,
			analyses: {},
			bundles: { USAZGIQ: official },
			now: NOW
		});
		const row = view.events.find((event) => event.code === 'USAZGIQ');
		expect(scoutRank).not.toBe(99);
		expect(row).toMatchObject({ rank: 99, record: { wins: 1, losses: 2, ties: 3 } });
	});

	it('keeps the FTCScout meet rank at league meets, where FIRST ranks the whole league', () => {
		const league = {
			...season,
			events: season.events.map((entry) =>
				entry.event.code === 'USAZGIQ'
					? { ...entry, event: { ...entry.event, type: 'LeagueMeet' as const } }
					: entry
			)
		};
		const official = {
			...bundle,
			rankings: bundle.rankings.map((row) => (row.team === 2844 ? { ...row, rank: 99 } : row))
		};
		const view = buildTeamPage({
			season: league,
			ratings: pool,
			analyses: {},
			bundles: { USAZGIQ: official },
			now: NOW
		});
		expect(view.events.find((event) => event.code === 'USAZGIQ')?.rank).not.toBe(99);
	});

	it('writes the playoff result in plain words from the event bundle', () => {
		const view = buildTeamPage({
			season,
			ratings: pool,
			analyses: {},
			bundles: { USAZGIQ: bundle },
			now: NOW
		});
		expect(view.events[0].playoffs).toBe(
			'First pick of alliance 5, eliminated in lower bracket round 3'
		);
	});
});

describe('regionStanding', () => {
	const pool = [
		rating(1, 90, { region: 'USMI' }),
		rating(2, 70, { region: 'USAZ' }),
		rating(3, 60, { region: 'USMI' }),
		rating(4, 50, { region: 'USMI' })
	];

	it('ranks the team among teams from its region', () => {
		expect(regionStanding(pool[2], pool)).toEqual({ code: 'USMI', rank: 2, of: 3 });
		expect(regionStanding(pool[1], pool)).toEqual({ code: 'USAZ', rank: 1, of: 1 });
	});

	it('gives nothing when the team has no region', () => {
		expect(regionStanding(rating(5, 10, { region: null }), pool)).toBeNull();
	});
});

describe('eventBreakdown and seasonTrend', () => {
	const stats = (total: number) => ({
		rank: 1,
		rs: 4,
		tbp: 90,
		avgTips: 3,
		wins: 5,
		losses: 0,
		ties: 0,
		dq: 0,
		played: 5,
		opr: { total, auto: total / 4, teleop: (total * 3) / 4 }
	});
	const played = teamSeason(77, 'Test', [
		{ ...teamEvent({ code: 'AAA', name: 'First' }), stats: stats(40) },
		teamEvent({ code: 'SKIP', name: 'Not played' }),
		{ ...teamEvent({ code: 'BBB', name: 'Second' }), stats: stats(60) }
	]);
	const rated: EventAnalysis = {
		...analysis(77, ['Q1']),
		code: 'BBB',
		ratings: [
			{
				team: 77,
				opr: 64,
				parts: { auto: 16, hive: 30, flower: 4, garden: 6, park: 6, tips: 2 },
				matches: 5,
				rank: 1,
				prior: 50,
				history: []
			}
		]
	};

	it('uses analysis parts when there are some and event aOPR otherwise', () => {
		const rows = eventBreakdown(played, { BBB: rated }, null);
		expect(rows.map((row) => row.key)).toEqual(['AAA', 'BBB']);
		expect(rows[0]).toMatchObject({ opr: 40, auto: 10, teleop: 30, hive: null, tips: null });
		expect(rows[1]).toMatchObject({ opr: 64, auto: 16, teleop: 48, hive: 30, garden: 6 });
	});

	it('puts the season row first when the team has a season rating', () => {
		const rows = eventBreakdown(played, {}, rating(77, 80));
		expect(rows[0]).toMatchObject({ key: 'season', code: null, opr: 80, auto: 20, teleop: 60 });
		expect(rows).toHaveLength(3);
	});

	it('draws a trend only from two or more events and skips the season row', () => {
		const rows = eventBreakdown(played, { BBB: rated }, rating(77, 80));
		expect(seasonTrend(rows)).toEqual([
			{ label: 'First', value: 40 },
			{ label: 'Second', value: 64 }
		]);
		expect(seasonTrend(rows.slice(0, 2))).toEqual([]);
	});

	it('gives nothing before the team has played', () => {
		expect(eventBreakdown(teamSeason(77, 'Test', [teamEvent()]), {}, rating(77, 80))).toEqual([]);
	});
});

describe('awardLabel', () => {
	it('uses plain words for alliance awards and ordinals for places', () => {
		expect(
			awardLabel({ id: 13, name: 'Winning Alliance', placement: 1, team: 1, person: null })
		).toBe('Winning alliance');
		expect(
			awardLabel({ id: 12, name: 'Finalist Alliance', placement: 2, team: 1, person: null })
		).toBe('Finalist alliance');
		expect(awardLabel({ id: 11, name: 'Inspire Award', placement: 1, team: 1, person: null })).toBe(
			'Inspire Award'
		);
		expect(awardLabel({ id: 11, name: 'Inspire Award', placement: 2, team: 1, person: null })).toBe(
			'Inspire Award 2nd place'
		);
	});
});
