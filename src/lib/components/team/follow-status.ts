import { dayTime, MISSING, record, shortDate } from '#lib/format/index.ts';
import type { Event, Match, Ranking, TeamSeason, TeamSeasonEvent } from '#lib/types.ts';
import { localDay } from './dates.ts';

export type EventStanding = 'now' | 'next' | 'last';

export interface ChosenEvent {
	entry: TeamSeasonEvent;
	standing: EventStanding;
}

export interface FollowedRow {
	team: number;
	name: string | null;
	eventCode: string | null;
	event: string;
	when: string;
	next: string;
	rank: string;
}

export interface FollowedBundle {
	matches: Match[];
	rankings: Ranking[];
	event: Pick<Event, 'timezone'>;
}

export function chooseEvent(season: TeamSeason, now: number): ChosenEvent | null {
	const events = season.events;
	const current = events.find((entry) => {
		const day = localDay(now, entry.event.timezone);
		return entry.event.start <= day && day <= entry.event.end;
	});
	if (current) return { entry: current, standing: 'now' };
	const upcoming = events.find((entry) => localDay(now, entry.event.timezone) < entry.event.start);
	if (upcoming) return { entry: upcoming, standing: 'next' };
	const last = events[events.length - 1];
	return last ? { entry: last, standing: 'last' } : null;
}

export function nextMatch(bundle: FollowedBundle, team: number, now = Date.now()): string {
	if (bundle.matches.length === 0) return 'Schedule not posted';
	const plays = (match: Match) =>
		match.red.some((entry) => entry.team === team) ||
		match.blue.some((entry) => entry.team === team);
	const next = bundle.matches.find((match) => match.result === null && plays(match));
	if (!next) return bundle.matches.some(plays) ? 'No matches left' : 'Not scheduled';
	const side = next.red.some((entry) => entry.team === team) ? 'red' : 'blue';
	const at = next.scheduledTime
		? ` at ${dayTime(next.scheduledTime, now, bundle.event.timezone)}`
		: '';
	return `${next.label}${at}, ${side}`;
}

export function standing(bundle: FollowedBundle, team: number): string {
	const ranking = bundle.rankings.find((entry) => entry.team === team);
	if (!ranking) return MISSING;
	return `${ranking.rank} of ${bundle.rankings.length}, ${record(ranking.wins, ranking.losses, ranking.ties)}`;
}

function whenText(chosen: ChosenEvent): string {
	const { start, end } = chosen.entry.event;
	if (chosen.standing === 'now') return 'Today';
	if (chosen.standing === 'next') return `Starts ${shortDate(start)}`;
	return `Ended ${shortDate(end)}`;
}

export function followedRow(
	season: TeamSeason,
	chosen: ChosenEvent | null,
	bundle: FollowedBundle | null,
	now = Date.now()
): FollowedRow {
	const base = { team: season.team.number, name: season.team.name };
	if (!chosen) {
		return {
			...base,
			eventCode: null,
			event: 'No events this season',
			when: '',
			next: MISSING,
			rank: MISSING
		};
	}
	return {
		...base,
		eventCode: chosen.entry.event.code,
		event: chosen.entry.event.name,
		when: whenText(chosen),
		next: bundle ? nextMatch(bundle, season.team.number, now) : MISSING,
		rank: bundle ? standing(bundle, season.team.number) : MISSING
	};
}

export function unavailableRow(team: number): FollowedRow {
	return {
		team,
		name: null,
		eventCode: null,
		event: 'Could not load this team',
		when: '',
		next: MISSING,
		rank: MISSING
	};
}
