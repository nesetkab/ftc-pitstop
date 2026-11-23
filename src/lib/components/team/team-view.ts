import type {
	EventAnalysis,
	RatingParts,
	SeasonRating,
	SeasonRatings
} from '#lib/analysis/types.ts';
import { matchLabel, parseMatchKey, shortDate } from '#lib/format/index.ts';
import { GAME_NAME, PART_LABELS, SEASON } from '#lib/game/biobuzz.ts';
import { hasPlayoffs } from '#lib/game/event-types.ts';
import type { Award, EventBundle, QuickStat, QuickStats, TeamSeason } from '#lib/types.ts';
import { awardName } from '#lib/components/event/awards.ts';
import { localDay } from './dates.ts';
import { placeName } from '#lib/format/places.ts';
import { teamMatches, type TeamMatchEvent } from './matches.ts';
import { playoffSummary } from './playoffs.ts';
import {
	advancementRows,
	allianceScores,
	allySummary,
	playedMatches,
	rpHabits,
	seasonTakeaways,
	upcomingEvents,
	type AdvancementRow,
	type AllySummary,
	type UpcomingEventRow
} from './season-report.ts';

export const SEASON_GAMES: Record<number, string> = {
	2021: 'Freight Frenzy',
	2022: 'POWERPLAY',
	2023: 'CENTERSTAGE',
	2024: 'INTO THE DEEP',
	2025: 'DECODE',
	[SEASON]: GAME_NAME
};

export interface ChartPoint {
	label: string;
	value: number;
}

export interface ChartDivider {
	after: number;
	label: string;
}

export interface TeamChart {
	id: string;
	title: string;
	label: string;
	points: ChartPoint[];
	divider: ChartDivider | null;
}

export interface RecordTotals {
	wins: number;
	losses: number;
	ties: number;
}

export interface TeamComparisonRow {
	key: string;
	label: string;
	value: number;
	percentile: number | null;
	nested: boolean;
}

export interface TeamEventRow {
	code: string;
	name: string;
	start: string;
	end: string;
	rank: number | null;
	record: RecordTotals | null;
	opr: number | null;
	playoffs: string | null;
	awards: string[];
}

export interface TeamAwardRow {
	code: string;
	event: string;
	name: string;
}

export interface RegionStanding {
	code: string;
	rank: number;
	of: number;
}

export interface TeamPartRow {
	key: string;
	label: string;
	code: string | null;
	opr: number;
	auto: number | null;
	teleop: number | null;
	hive: number | null;
	flower: number | null;
	garden: number | null;
	park: number | null;
	tips: number | null;
}

export interface PreviousSeasonRow {
	key: string;
	label: string;
	value: number;
	rank: number;
}

export interface PreviousSeason {
	season: number;
	game: string | null;
	count: number;
	rows: PreviousSeasonRow[];
}

export interface TeamPageData {
	team: { number: number; name: string; place: string; rookieYear: number | null };
	source: 'ratings' | 'scout';
	takeaways: string[];
	stats: {
		opr: number | null;
		rank: number | null;
		of: number | null;
		record: RecordTotals | null;
		events: number;
		region: RegionStanding | null;
	};
	trend: ChartPoint[];
	breakdown: TeamPartRow[];
	chartTitle: string;
	charts: TeamChart[];
	comparison: TeamComparisonRow[];
	events: TeamEventRow[];
	matches: TeamMatchEvent[];
	awards: TeamAwardRow[];
	advancement: AdvancementRow[];
	upcoming: UpcomingEventRow[];
	allies: AllySummary;
	previous: PreviousSeason | null;
	updated: number;
	stale: boolean;
}

export interface TeamViewInput {
	season: TeamSeason;
	ratings: SeasonRatings | null;
	analyses: Record<string, EventAnalysis | null>;
	bundles: Record<
		string,
		| (Pick<EventBundle, 'alliances' | 'matches' | 'phase'> &
				Partial<Pick<EventBundle, 'teams' | 'advancement'>>)
		| null
	>;
	now: number;
}

const MAX_CHARTS = 4;

const WINNING_ALLIANCE = 13;
const FINALIST_ALLIANCE = 12;

export function ratedTeams(ratings: SeasonRatings | null): SeasonRating[] {
	return (ratings?.teams ?? []).filter((entry) => entry.matches > 0 && Number.isFinite(entry.opr));
}

export function percentileOf(values: number[], mine: number): number | null {
	if (values.length === 0) return null;
	let below = 0;
	for (const value of values) if (value < mine) below += 1;
	return Math.floor((100 * below) / values.length);
}

export function rankPercentile(rank: number, of: number): number | null {
	if (!(of > 0) || !(rank >= 1)) return null;
	return Math.min(99, Math.max(0, Math.floor((100 * (of - rank)) / of)));
}

export function awardLabel(award: Award): string {
	if (award.id === WINNING_ALLIANCE || award.id === FINALIST_ALLIANCE) {
		return awardName({ name: award.name });
	}
	return awardName(award);
}

function measure(
	key: string,
	label: string,
	value: number,
	pool: number[],
	nested = false
): TeamComparisonRow {
	return { key, label, value, percentile: percentileOf(pool, value), nested };
}

function ratingComparison(mine: SeasonRating, pool: SeasonRating[]): TeamComparisonRow[] {
	const parts = mine.parts;
	return [
		measure(
			'total',
			PART_LABELS.total,
			mine.opr,
			pool.map((entry) => entry.opr)
		),
		measure(
			'auto',
			PART_LABELS.auto,
			parts.auto,
			pool.map((entry) => entry.parts.auto)
		),
		measure(
			'teleop',
			PART_LABELS.teleop,
			mine.opr - parts.auto,
			pool.map((entry) => entry.opr - entry.parts.auto)
		),
		measure(
			'hive',
			PART_LABELS.hive,
			parts.hive,
			pool.map((entry) => entry.parts.hive),
			true
		),
		measure(
			'flower',
			PART_LABELS.flower,
			parts.flower,
			pool.map((entry) => entry.parts.flower),
			true
		),
		measure(
			'garden',
			PART_LABELS.garden,
			parts.garden,
			pool.map((entry) => entry.parts.garden),
			true
		),
		measure(
			'park',
			PART_LABELS.park,
			parts.park,
			pool.map((entry) => entry.parts.park),
			true
		),
		measure(
			'tips',
			PART_LABELS.tips,
			parts.tips,
			pool.map((entry) => entry.parts.tips),
			true
		)
	];
}

function quickComparison(stats: QuickStats): TeamComparisonRow[] {
	const row = (key: string, label: string, stat: QuickStat): TeamComparisonRow => ({
		key,
		label,
		value: stat.value,
		percentile: rankPercentile(stat.rank, stats.count),
		nested: false
	});
	return [
		row('total', 'Total', stats.total),
		row('auto', 'Auto', stats.auto),
		row('teleop', 'Teleop', stats.teleop)
	];
}

function keyLabel(key: string): string {
	const parsed = parseMatchKey(key);
	return parsed ? matchLabel(parsed) : key.toUpperCase();
}

function isQualKey(key: string): boolean {
	return key.trim().toLowerCase().startsWith('q');
}

function historyChart(
	code: string,
	name: string,
	analysis: EventAnalysis | null | undefined,
	team: number
): TeamChart | null {
	const rating = analysis?.ratings.find((entry) => entry.team === team);
	if (!rating || rating.history.length === 0) return null;
	const history = [...rating.history].sort((a, b) => a.time - b.time);
	const lastQual = history.findLastIndex((entry) => isQualKey(entry.key));
	return {
		id: code,
		title: name,
		label: `OPR after each match at ${name}`,
		points: history.map((entry) => ({ label: keyLabel(entry.key), value: entry.opr })),
		divider:
			lastQual >= 0 && lastQual < history.length - 1 ? { after: lastQual, label: 'Playoffs' } : null
	};
}

export function regionStanding(mine: SeasonRating, pool: SeasonRating[]): RegionStanding | null {
	if (!mine.region) return null;
	const peers = pool.filter((entry) => entry.region === mine.region);
	return {
		code: mine.region,
		rank: 1 + peers.filter((entry) => entry.opr > mine.opr).length,
		of: peers.length
	};
}

function partRow(
	key: string,
	label: string,
	code: string | null,
	opr: number,
	parts: RatingParts
): TeamPartRow {
	return { key, label, code, opr, teleop: opr - parts.auto, ...parts };
}

export function eventBreakdown(
	season: TeamSeason,
	analyses: Record<string, EventAnalysis | null>,
	mine: SeasonRating | null
): TeamPartRow[] {
	const number = season.team.number;
	const events = season.events.flatMap<TeamPartRow>((entry) => {
		const { event, stats } = entry;
		if (!stats) return [];
		const rating = analyses[event.code]?.ratings.find((item) => item.team === number);
		if (rating) return [partRow(event.code, event.name, event.code, rating.opr, rating.parts)];
		return [
			{
				key: event.code,
				label: event.name,
				code: event.code,
				opr: stats.opr.total,
				auto: stats.opr.auto,
				teleop: stats.opr.teleop,
				hive: null,
				flower: null,
				garden: null,
				park: null,
				tips: null
			}
		];
	});
	if (events.length === 0) return [];
	return mine ? [partRow('season', 'Season', null, mine.opr, mine.parts), ...events] : events;
}

export function seasonTrend(breakdown: TeamPartRow[]): ChartPoint[] {
	const events = breakdown.filter((row) => row.code !== null);
	return events.length < 2 ? [] : events.map((row) => ({ label: row.label, value: row.opr }));
}

function sumRecord(season: TeamSeason): RecordTotals | null {
	const played = season.events.filter((entry) => entry.stats !== null);
	if (played.length === 0) return null;
	return played.reduce<RecordTotals>(
		(total, entry) => ({
			wins: total.wins + (entry.stats?.wins ?? 0),
			losses: total.losses + (entry.stats?.losses ?? 0),
			ties: total.ties + (entry.stats?.ties ?? 0)
		}),
		{ wins: 0, losses: 0, ties: 0 }
	);
}

function previousSeason(stats: QuickStats | null): PreviousSeason | null {
	if (!stats) return null;
	return {
		season: stats.season,
		game: SEASON_GAMES[stats.season] ?? null,
		count: stats.count,
		rows: [
			{ key: 'total', label: 'Total', ...stats.total },
			{ key: 'auto', label: 'Auto', ...stats.auto },
			{ key: 'teleop', label: 'Teleop', ...stats.teleop },
			{ key: 'endgame', label: 'Endgame', ...stats.endgame }
		]
	};
}

export function buildTeamPage(input: TeamViewInput): TeamPageData {
	const { season, ratings, analyses, bundles, now } = input;
	const number = season.team.number;
	const pool = ratedTeams(ratings);
	const mine = pool.find((entry) => entry.team === number) ?? null;
	const played = season.events.filter((entry) => entry.stats !== null);
	const quick = season.quickStats;
	const bestEventOpr = played.reduce<number | null>((best, entry) => {
		const value = entry.stats?.opr.total ?? null;
		return value !== null && (best === null || value > best) ? value : best;
	}, null);

	let stats: TeamPageData['stats'];
	let comparison: TeamComparisonRow[];
	if (mine) {
		stats = {
			opr: mine.opr,
			rank: 1 + pool.filter((entry) => entry.opr > mine.opr).length,
			of: pool.length,
			record: sumRecord(season),
			events: played.length,
			region: regionStanding(mine, pool)
		};
		comparison = ratingComparison(mine, pool);
	} else {
		stats = {
			opr: quick?.total.value ?? bestEventOpr,
			rank: quick?.total.rank ?? null,
			of: quick?.count ?? null,
			record: sumRecord(season),
			events: played.length,
			region: null
		};
		comparison = quick ? quickComparison(quick) : [];
	}

	const breakdown = eventBreakdown(season, analyses, mine);

	const histories = season.events
		.map((entry) =>
			historyChart(entry.event.code, entry.event.name, analyses[entry.event.code], number)
		)
		.filter((chart): chart is TeamChart => chart !== null)
		.slice(-MAX_CHARTS);

	const charts =
		histories.length > 0
			? histories
			: played.length > 0
				? [
						{
							id: 'events',
							title: 'OPR at each event',
							label: `OPR at each event for team ${number}`,
							points: played.map((entry) => ({
								label: shortDate(entry.event.start),
								value: entry.stats?.opr.total ?? 0
							})),
							divider: null
						}
					]
				: [];

	const eventOpr = (entry: TeamSeason['events'][number]) =>
		analyses[entry.event.code]?.ratings.find((rating) => rating.team === number)?.opr ??
		entry.stats?.opr.total ??
		null;

	const events = season.events.map<TeamEventRow>((entry) => {
		const { event } = entry;
		const day = localDay(now, event.timezone);
		const bundle = hasPlayoffs(event.type) ? bundles[event.code] : null;
		let playoffs: string | null;
		if (entry.stats) playoffs = bundle ? playoffSummary(bundle, number) : null;
		else if (day < event.start) playoffs = 'Upcoming';
		else if (day <= event.end) playoffs = 'In progress';
		else playoffs = event.hasMatches ? "Didn't play" : 'No results';
		return {
			code: event.code,
			name: event.name,
			start: event.start,
			end: event.end,
			rank: entry.stats?.rank ?? null,
			record: entry.stats
				? { wins: entry.stats.wins, losses: entry.stats.losses, ties: entry.stats.ties }
				: null,
			opr: entry.stats ? eventOpr(entry) : null,
			playoffs,
			awards: entry.awards.map(awardLabel)
		};
	});

	const awards = season.events.flatMap((entry) =>
		entry.awards.map((award) => ({
			code: entry.event.code,
			event: entry.event.name,
			name: awardLabel(award)
		}))
	);
	const advancement = advancementRows(season, bundles);
	const upcoming = upcomingEvents(season, bundles, analyses, pool, now);
	const seasonMatches = playedMatches(season, bundles);
	const trend = seasonTrend(breakdown);
	const previous = previousSeason(season.previousQuickStats);
	const takeaways = seasonTakeaways({
		stats,
		comparison,
		trend,
		awards,
		advancement,
		upcoming,
		previous: previous ? { ...previous.rows[0], count: previous.count } : null,
		rookie: season.team.rookieYear === SEASON,
		scores: allianceScores(seasonMatches),
		rp: rpHabits(seasonMatches, bundles)
	});

	return {
		team: {
			number,
			name: season.team.name,
			place: placeName(season.team),
			rookieYear: season.team.rookieYear
		},
		source: mine ? 'ratings' : 'scout',
		takeaways,
		stats,
		trend,
		breakdown,
		chartTitle: histories.length > 0 ? 'OPR after each match' : 'OPR at each event',
		charts,
		comparison,
		events,
		matches: teamMatches(season, bundles, number),
		awards,
		advancement,
		upcoming,
		allies: allySummary(season, bundles, pool, seasonMatches),
		previous,
		updated: season.fetchedAt,
		stale: season.stale
	};
}
