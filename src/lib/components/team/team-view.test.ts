import { beforeAll, describe, expect, it } from 'vitest';
import type { EventAnalysis, SeasonRating, SeasonRatings } from '#lib/analysis/types.ts';
import type { EventBundle, TeamSeason } from '#lib/types.ts';
import { fixtureLoaders, scoutTeamSeason } from './fixtures.server.ts';
import {
	awardLabel,
	buildTeamPage,
	percentileOf,
	ratedTeams,
	rankPercentile
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

	it('draws one OPR point per event', () => {
		const view = buildTeamPage({ season, ratings: null, analyses: {}, bundles: {}, now: NOW });
		expect(view.chartTitle).toBe('OPR at each event');
		expect(view.charts).toHaveLength(1);
		expect(view.charts[0].points).toEqual([{ label: 'Nov 14', value: expect.any(Number) }]);
		expect(view.charts[0].points[0].value).toBeCloseTo(47.3615, 3);
	});

	it('lists the event with its award and no playoff text without a bundle', () => {
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
				playoffs: null,
				awards: ['Inspire Award, 3rd place']
			}
		]);
		expect(view.awards).toEqual([
			{
				code: 'USAZGIQ',
				event: 'Roadrunner - Gilbert Qualifier',
				name: 'Inspire Award, 3rd place'
			}
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
		expect(view.stats).toEqual({ opr: null, rank: null, of: null, record: null, events: 0 });
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

	it('labels events that have not happened or are still running', () => {
		const entry = season.events[0];
		const base = { ...season, quickStats: null, previousQuickStats: null };
		const before = buildTeamPage({
			season: { ...base, events: [{ ...entry, stats: null, awards: [] }] },
			ratings: null,
			analyses: {},
			bundles: {},
			now: Date.parse('2026-11-10T12:00:00Z')
		});
		expect(before.events[0].playoffs).toBe('Upcoming');
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

	it('charts OPR after each match and marks where playoffs start', () => {
		const view = buildTeamPage({
			season,
			ratings: pool,
			analyses: { USAZGIQ: analysis(2844, ['q3', 'q9', 'p1', 'p3']) },
			bundles: {},
			now: NOW
		});
		expect(view.chartTitle).toBe('OPR after each match');
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
		expect(view.chartTitle).toBe('OPR at each event');
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
			'Inspire Award, 2nd place'
		);
	});
});
