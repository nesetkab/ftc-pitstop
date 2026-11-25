import type { SeasonRatings } from '#lib/analysis/types.ts';
import type { BadgeStat } from '#lib/badge/links.ts';
import { oprRank, upcomingEntries } from '#lib/components/team/season-report.ts';
import { ratedTeams, regionStanding } from '#lib/components/team/team-view.ts';
import { localDate } from '#lib/format/calendar.ts';
import { fixed, integer, MISSING, ordinal, record, shortDate } from '#lib/format/index.ts';
import { regionName } from '#lib/format/places.ts';
import { SEASON_NAME } from '#lib/seo.ts';
import type { TeamSeason } from '#lib/types.ts';
import type { BadgeText, CardData } from './svg.ts';

export interface BadgeDeps {
	loadTeamSeason(number: number): Promise<TeamSeason | null>;
	loadSeasonRatings(): Promise<SeasonRatings | null>;
}

export interface Standing {
	rank: number;
	of: number;
}

export interface BadgeFacts {
	number: number;
	name: string;
	opr: number | null;
	world: Standing | null;
	region: (Standing & { name: string }) | null;
	record: { wins: number; losses: number; ties: number } | null;
	next: { name: string; start: string; live: boolean } | null;
	trend: number[];
	complete: boolean;
}

export const TEAM_NUMBER = /^[1-9]\d{0,4}$/;

function rankText(rank: number): string {
	return `${integer(rank)}${ordinal(rank).slice(String(rank).length)}`;
}

function totals(season: TeamSeason): BadgeFacts['record'] {
	const played = season.events.flatMap((entry) => (entry.stats ? [entry.stats] : []));
	if (played.length === 0) return null;
	return played.reduce(
		(sum, stats) => ({
			wins: sum.wins + stats.wins,
			losses: sum.losses + stats.losses,
			ties: sum.ties + stats.ties
		}),
		{ wins: 0, losses: 0, ties: 0 }
	);
}

function trendOf(season: TeamSeason): number[] {
	return season.events
		.flatMap((entry) =>
			entry.stats ? [{ start: entry.event.start, opr: entry.stats.opr.total }] : []
		)
		.filter((entry) => Number.isFinite(entry.opr))
		.sort((a, b) => a.start.localeCompare(b.start))
		.map((entry) => entry.opr);
}

export function badgeFacts(
	season: TeamSeason,
	ratings: SeasonRatings | null,
	now: number
): BadgeFacts {
	const number = season.team.number;
	const pool = ratedTeams(ratings);
	const mine = pool.find((entry) => entry.team === number) ?? null;
	const quick = season.quickStats;
	const standing = mine ? regionStanding(mine, pool) : null;
	const upcoming = upcomingEntries(season, now)[0] ?? null;
	return {
		number,
		name: season.team.name,
		opr: mine?.opr ?? quick?.total.value ?? null,
		world: mine
			? { rank: oprRank(pool, mine), of: pool.length }
			: quick
				? { rank: quick.total.rank, of: quick.count }
				: null,
		region: standing
			? { rank: standing.rank, of: standing.of, name: regionName(standing.code) }
			: null,
		record: totals(season),
		next: upcoming
			? {
					name: upcoming.event.name,
					start: upcoming.event.start,
					live: localDate(now, upcoming.event.timezone) >= upcoming.event.start
				}
			: null,
		trend: trendOf(season),
		complete: ratings !== null && !season.stale
	};
}

export async function loadBadgeFacts(
	deps: BadgeDeps,
	number: number,
	now: number
): Promise<BadgeFacts | null> {
	const [season, ratings] = await Promise.all([
		deps.loadTeamSeason(number),
		deps.loadSeasonRatings().catch(() => null)
	]);
	return season ? badgeFacts(season, ratings, now) : null;
}

const NO_MATCHES = 'no matches yet';

function oprText(facts: BadgeFacts): string {
	return facts.opr === null ? NO_MATCHES : fixed(facts.opr);
}

function standingText(standing: Standing | null, empty: string): string {
	return standing ? `${rankText(standing.rank)} of ${integer(standing.of)}` : empty;
}

function recordText(facts: BadgeFacts): string {
	return facts.record
		? record(facts.record.wins, facts.record.losses, facts.record.ties)
		: NO_MATCHES;
}

function nextText(facts: BadgeFacts): string {
	if (!facts.next) return 'none scheduled';
	const when = facts.next.live ? 'now' : shortDate(facts.next.start);
	return `${facts.next.name} · ${when}`;
}

export function badgeText(facts: BadgeFacts, stat: BadgeStat | null): BadgeText {
	const team = String(facts.number);
	switch (stat) {
		case 'opr':
			return { label: `${team} season aOPR`, value: oprText(facts) };
		case 'rank':
			return { label: `${team} world rank`, value: standingText(facts.world, 'not ranked yet') };
		case 'region':
			return {
				label: facts.region ? `${team} rank in ${facts.region.name}` : `${team} region rank`,
				value: standingText(facts.region, 'not ranked yet')
			};
		case 'record':
			return { label: `${team} qual record`, value: recordText(facts) };
		case 'next':
			return { label: `${team} next event`, value: nextText(facts) };
		default: {
			if (facts.opr === null) return { label: `FTC ${team}`, value: NO_MATCHES };
			const world = facts.world ? ` · ${rankText(facts.world.rank)} worldwide` : '';
			return { label: `FTC ${team}`, value: `aOPR ${fixed(facts.opr)}${world}` };
		}
	}
}

export const MISSING_BADGE: BadgeText = { label: 'PitStop', value: 'team not found' };

export const UNAVAILABLE_BADGE: BadgeText = { label: 'PitStop', value: 'data unavailable' };

export function cardData(facts: BadgeFacts): CardData {
	return {
		title: String(facts.number),
		name: facts.name,
		meta: `${SEASON_NAME} · ftcpitstop.com`,
		stats: [
			{ label: 'Season aOPR', value: facts.opr === null ? MISSING : fixed(facts.opr) },
			{
				label: 'World rank',
				value: facts.world ? integer(facts.world.rank) : MISSING,
				suffix: facts.world ? `of ${integer(facts.world.of)}` : undefined
			},
			{
				label: facts.region ? `Rank in ${facts.region.name}` : 'Region rank',
				value: facts.region ? integer(facts.region.rank) : MISSING,
				suffix: facts.region ? `of ${integer(facts.region.of)}` : undefined
			},
			{ label: 'Qual record', value: facts.record ? recordText(facts) : MISSING }
		],
		trend: facts.trend
	};
}

function emptyCard(title: string, meta: string): CardData {
	return { title, name: '', meta, stats: [], trend: [] };
}

export function missingCard(): CardData {
	return emptyCard('Team not found', 'PitStop has no FTC team with this number.');
}

export function unavailableCard(): CardData {
	return emptyCard('Data unavailable', 'PitStop could not load this team right now.');
}
