import type { SeasonRating } from '#lib/analysis/types.ts';
import { nextMatchIndex, opposite, scheduleTimes, sideOf } from '#lib/components/event/matches.ts';
import { pickEvent, type EventPickReason } from '#lib/components/pit/resolve.ts';
import { dayTime } from '#lib/format/time.ts';
import { estimateStarts, PLAYOFF_SCHEDULE } from '#lib/model/schedule.ts';
import type { AllianceColor, EventBundle, Match, TeamSeason } from '#lib/types.ts';

export const MAX_FOLLOWED = 12;

export interface FollowedEvent {
	code: string;
	name: string;
	start: string;
	end: string;
	timezone: string;
	reason: EventPickReason;
}

export interface FollowedStanding {
	rank: number;
	wins: number;
	losses: number;
	ties: number;
}

export interface FollowedTeam {
	number: number;
	name: string | null;
	found: boolean;
	event: FollowedEvent | null;
	standing: FollowedStanding | null;
	opr: number | null;
	worldRank: number | null;
	rated: number | null;
}

export interface PlannedMatch {
	key: string;
	label: string;
	side: AllianceColor;
	at: number | null;
	estimated: boolean;
}

export interface NextMatch extends PlannedMatch {
	when: string | null;
}

export interface LastMatch {
	key: string;
	label: string;
	outcome: 'W' | 'L' | 'T';
	own: number;
	other: number;
}

export interface TeamLive {
	rank: number | null;
	record: string | null;
	next: PlannedMatch | null;
	note: string | null;
	last: LastMatch | null;
}

export interface LiveStatus extends Omit<TeamLive, 'next'> {
	teams: number;
	next: NextMatch | null;
}

export interface LiveFeed {
	teams: number;
	scheduled: boolean;
	status: Record<number, TeamLive>;
}

export type LiveBundle = Pick<EventBundle, 'matches' | 'rankings'> & {
	event: Pick<EventBundle['event'], 'timezone'>;
};

export function parseTeamList(raw: string | null): number[] {
	if (!raw) return [];
	const numbers = raw
		.split(',')
		.map((part) => part.trim())
		.filter((part) => /^[1-9]\d{0,5}$/.test(part))
		.map(Number);
	return [...new Set(numbers)].slice(0, MAX_FOLLOWED);
}

export function teamListQuery(teams: number[]): string {
	return [...new Set(teams)]
		.slice(0, MAX_FOLLOWED)
		.sort((a, b) => a - b)
		.join(',');
}

export function followedTeam(
	number: number,
	season: TeamSeason | null,
	rating: { rating: SeasonRating | null; rated: number },
	now: number
): FollowedTeam {
	if (!season) {
		return {
			number,
			name: null,
			found: false,
			event: null,
			standing: null,
			opr: null,
			worldRank: null,
			rated: null
		};
	}
	const pick = pickEvent(
		season.events.map((entry) => entry.event),
		now
	);
	const stats =
		pick?.reason === 'today'
			? (season.events.find((entry) => entry.event.code === pick.event.code)?.stats ?? null)
			: null;
	const quick = season.quickStats?.total ?? null;
	const own = rating.rating;
	return {
		number,
		name: season.team.name,
		found: true,
		event: pick
			? {
					code: pick.event.code,
					name: pick.event.name,
					start: pick.event.start,
					end: pick.event.end,
					timezone: pick.event.timezone,
					reason: pick.reason
				}
			: null,
		standing: stats
			? { rank: stats.rank, wins: stats.wins, losses: stats.losses, ties: stats.ties }
			: null,
		opr: own?.opr ?? quick?.value ?? null,
		worldRank: own?.rank ?? quick?.rank ?? null,
		rated: own ? rating.rated : (season.quickStats?.count ?? null)
	};
}

function estimatedStarts(matches: Match[], now: number): Map<string, number | null> {
	const starts = new Map<string, number | null>();
	for (const level of new Set(matches.map((match) => match.level))) {
		const options = level === 'playoff' ? { ...PLAYOFF_SCHEDULE, now } : { now };
		const times = scheduleTimes(matches.filter((match) => match.level === level));
		for (const entry of estimateStarts(times, options)) starts.set(entry.key, entry.start);
	}
	return starts;
}

function nextMatch(
	bundle: LiveBundle,
	team: number,
	starts: Map<string, number | null>
): PlannedMatch | null {
	const next = bundle.matches[nextMatchIndex(bundle.matches, team)];
	if (!next) return null;
	const estimate = next.scheduledTime === null ? null : (starts.get(next.key) ?? null);
	const at = estimate ?? next.scheduledTime;
	return {
		key: next.key,
		label: next.label,
		side: sideOf(next, team)!,
		at,
		estimated:
			at !== null && next.scheduledTime !== null && Math.abs(at - next.scheduledTime) > 60_000
	};
}

function lastMatch(bundle: LiveBundle, team: number): LastMatch | null {
	const played = bundle.matches.filter((match) => match.result && sideOf(match, team));
	const last = played.at(-1);
	if (!last?.result) return null;
	const side = sideOf(last, team)!;
	const other = opposite(side);
	const winner = last.result.winner;
	return {
		key: last.key,
		label: last.label,
		outcome: winner === null ? 'T' : winner === side ? 'W' : 'L',
		own: last.result[side].total,
		other: last.result[other].total
	};
}

function plays(bundle: LiveBundle, team: number): boolean {
	return bundle.matches.some((match) => sideOf(match, team));
}

function missingNote(scheduled: boolean, playing: boolean): string {
	if (!scheduled) return 'Schedule not posted';
	return playing ? 'No matches left' : 'Not in the schedule';
}

function teamLive(bundle: LiveBundle, team: number, starts: Map<string, number | null>): TeamLive {
	const ranking = bundle.rankings.find((entry) => entry.team === team && entry.played > 0);
	const next = nextMatch(bundle, team, starts);
	return {
		rank: ranking?.rank ?? null,
		record: ranking ? `${ranking.wins}-${ranking.losses}-${ranking.ties}` : null,
		next,
		note: next ? null : missingNote(bundle.matches.length > 0, plays(bundle, team)),
		last: lastMatch(bundle, team)
	};
}

export function liveFeed(bundle: LiveBundle, now: number): LiveFeed {
	const teams = new Set(bundle.rankings.map((entry) => entry.team));
	for (const match of bundle.matches) {
		for (const entry of [...match.red, ...match.blue]) teams.add(entry.team);
	}
	const starts = estimatedStarts(bundle.matches, now);
	const status: Record<number, TeamLive> = {};
	for (const team of [...teams].sort((a, b) => a - b)) {
		status[team] = teamLive(bundle, team, starts);
	}
	return { teams: bundle.rankings.length, scheduled: bundle.matches.length > 0, status };
}

export function liveStatus(
	feed: LiveFeed,
	team: number,
	now: number,
	timeZone: string
): LiveStatus {
	const own = feed.status[team];
	if (own) {
		const next = own.next && {
			...own.next,
			when: own.next.at === null ? null : dayTime(own.next.at, now, timeZone)
		};
		return { ...own, teams: feed.teams, next };
	}
	return {
		rank: null,
		teams: feed.teams,
		record: null,
		next: null,
		note: missingNote(feed.scheduled, false),
		last: null
	};
}
