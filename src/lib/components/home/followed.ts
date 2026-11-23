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

export interface NextMatch {
	key: string;
	label: string;
	side: AllianceColor;
	at: number | null;
	estimated: boolean;
	when: string | null;
}

export interface LastMatch {
	key: string;
	label: string;
	outcome: 'W' | 'L' | 'T';
	own: number;
	other: number;
}

export interface LiveStatus {
	rank: number | null;
	teams: number;
	record: string | null;
	next: NextMatch | null;
	note: string | null;
	last: LastMatch | null;
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

function estimateFor(matches: Match[], next: Match, now: number): number | null {
	const level = matches.filter((match) => match.level === next.level);
	const options = next.level === 'playoff' ? { ...PLAYOFF_SCHEDULE, now } : { now };
	return (
		estimateStarts(scheduleTimes(level), options).find((entry) => entry.key === next.key)?.start ??
		null
	);
}

function nextMatch(bundle: LiveBundle, team: number, now: number): NextMatch | null {
	const next = bundle.matches[nextMatchIndex(bundle.matches, team)];
	if (!next) return null;
	const estimate = next.scheduledTime === null ? null : estimateFor(bundle.matches, next, now);
	const at = estimate ?? next.scheduledTime;
	return {
		key: next.key,
		label: next.label,
		side: sideOf(next, team)!,
		at,
		estimated:
			at !== null && next.scheduledTime !== null && Math.abs(at - next.scheduledTime) > 60_000,
		when: at === null ? null : dayTime(at, now, bundle.event.timezone)
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

export function liveStatus(bundle: LiveBundle, team: number, now: number): LiveStatus {
	const ranking = bundle.rankings.find((entry) => entry.team === team && entry.played > 0);
	const plays = bundle.matches.some((match) => sideOf(match, team));
	const next = nextMatch(bundle, team, now);
	let note: string | null = null;
	if (!next) {
		if (bundle.matches.length === 0) note = 'Schedule not posted';
		else note = plays ? 'No matches left' : 'Not in the schedule';
	}
	return {
		rank: ranking?.rank ?? null,
		teams: bundle.rankings.length,
		record: ranking ? `${ranking.wins}-${ranking.losses}-${ranking.ties}` : null,
		next,
		note,
		last: lastMatch(bundle, team)
	};
}
