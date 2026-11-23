import { eventStatus } from '#lib/components/event/dates.ts';
import { typeNoun } from '#lib/components/event/event-meta.ts';
import {
	opposite,
	scheduleTimes,
	sideOf,
	teamNumbers,
	titleOf
} from '#lib/components/event/matches.ts';
import { addDays, localDate } from '#lib/format/calendar.ts';
import { ordinal } from '#lib/format/ordinal.ts';
import { dateRange, time } from '#lib/format/time.ts';
import { placeName } from '#lib/format/places.ts';
import { SEASON } from '#lib/game/biobuzz.ts';
import { estimateStarts, PLAYOFF_SCHEDULE, type ScheduleOptions } from '#lib/model/schedule.ts';
import { allDay, type IcsCalendar, type IcsEvent, type IcsTime } from '#lib/server/calendar/ics.ts';
import type {
	AllianceColor,
	Event,
	EventBundle,
	EventSummary,
	Match,
	Team,
	TeamSeason
} from '#lib/types.ts';

export const UID_DOMAIN = 'ftcpitstop.com';
export const SCHEDULE_LEAD_DAYS = 3;

const MINUTE = 60_000;
const MATCH_MINUTES = 10;
const LIVE_REFRESH = 15;
const QUIET_REFRESH = 360;

export interface MatchTime {
	start: number;
	estimated: boolean;
	played: boolean;
}

type Place = Pick<Event, 'venue' | 'city' | 'state' | 'country'> & { address?: string | null };

function byLevel(matches: Match[]): [Match[], ScheduleOptions][] {
	const quals = matches.filter((m) => m.level === 'qual').sort((a, b) => a.number - b.number);
	const playoffs = matches
		.filter((m) => m.level === 'playoff')
		.sort(
			(a, b) =>
				(a.scheduledTime ?? Infinity) - (b.scheduledTime ?? Infinity) ||
				a.series - b.series ||
				a.number - b.number
		);
	return [
		[quals, {}],
		[playoffs, PLAYOFF_SCHEDULE]
	];
}

export function matchTimes(bundle: EventBundle, now: number): Map<string, MatchTime> {
	const times = new Map<string, MatchTime>();
	const live = bundle.phase !== 'done' && eventStatus(bundle.event, now) === 'live';
	for (const [list, options] of byLevel(bundle.matches)) {
		if (list.length === 0) continue;
		const rows = scheduleTimes(list);
		const estimates = live ? estimateStarts(rows, { ...options, now }) : null;
		list.forEach((match, index) => {
			const played = rows[index].actual !== null;
			const known = played ? rows[index].actual : match.scheduledTime;
			const estimate = estimates?.[index];
			const exact = !played && estimate ? estimate.start : known;
			if (exact === null || !Number.isFinite(exact)) return;
			const start = Math.floor(exact / MINUTE) * MINUTE;
			const estimated =
				!played && match.scheduledTime !== null && Math.abs(start - match.scheduledTime) >= MINUTE;
			times.set(match.key, { start, estimated, played });
		});
	}
	return times;
}

function location(place: Place): string {
	const area = placeName(place);
	const city = place.city?.toLowerCase();
	const covered = Boolean(city && place.address?.toLowerCase().includes(city));
	return [place.venue, place.address, covered ? null : area].filter(Boolean).join(', ');
}

function teamName(names: Map<number, Team>, number: number): string {
	const name = names.get(number)?.name;
	return name ? `${number} ${name}` : String(number);
}

function joined(items: string[]): string {
	if (items.length <= 1) return items.join('');
	return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function clockText(instant: number, timeZone: string): string {
	return time(instant, timeZone).replace(/\s/g, ' ');
}

function timing(match: Match, at: MatchTime, timeZone: string): string {
	const clock = clockText(at.start, timeZone);
	if (at.played) return `Played at ${clock}.`;
	const scheduled = match.scheduledTime === null ? null : clockText(match.scheduledTime, timeZone);
	if (at.estimated && scheduled) return `Estimated start ${clock}, scheduled for ${scheduled}.`;
	return `Scheduled for ${clock}.`;
}

function scoreLine(match: Match): string | null {
	const result = match.result;
	if (!result) return null;
	const winner =
		result.winner === 'red' ? 'Red won' : result.winner === 'blue' ? 'Blue won' : 'Tied';
	return `${winner}, red ${result.red.total} to blue ${result.blue.total}.`;
}

function matchEnd(at: MatchTime): number {
	return at.start + MATCH_MINUTES * MINUTE;
}

function zonedRange(
	start: number,
	end: number,
	timeZone: string
): { start: IcsTime; end: IcsTime } {
	return { start: { at: start, timeZone }, end: { at: end, timeZone } };
}

function eventSpan(
	event: Pick<Event, 'start' | 'end' | 'timezone'>,
	times: MatchTime[]
): { start: IcsTime; end: IcsTime } {
	if (event.start === event.end && times.length > 0) {
		const first = Math.min(...times.map((at) => at.start));
		const last = Math.max(...times.map(matchEnd));
		const sameDay = localDate(first, event.timezone) === event.start;
		if (sameDay && localDate(last, event.timezone) === event.start) {
			return zonedRange(first, last, event.timezone);
		}
	}
	return allDay(event.start, event.end);
}

function eventUid(code: string, team?: number): string {
	return `${SEASON}-${code}${team ? `-${team}` : ''}@${UID_DOMAIN}`;
}

function matchUid(code: string, key: string, team?: number): string {
	return `${SEASON}-${code}-${key}${team ? `-${team}` : ''}@${UID_DOMAIN}`;
}

function eventEntry(
	event: EventSummary | Event,
	times: MatchTime[],
	origin: string,
	extra: string[],
	team?: number
): IcsEvent {
	const url = `${origin}/events/${event.code}`;
	const place = placeName(event);
	const what = [typeNoun(event.type), place].filter(Boolean).join(' in ');
	return {
		uid: eventUid(event.code, team),
		summary: event.name,
		...eventSpan(event, times),
		description: [`${what}.`, `${dateRange(event.start, event.end)}.`, ...extra, url].join('\n'),
		location: location(event) || undefined,
		url,
		transparent: true,
		categories: ['FTC']
	};
}

export function refreshMinutes(bundles: (EventBundle | null)[], now: number): number {
	const live = bundles.some(
		(bundle) => bundle && bundle.phase !== 'done' && eventStatus(bundle.event, now) === 'live'
	);
	return live ? LIVE_REFRESH : QUIET_REFRESH;
}

export function eventCalendar(bundle: EventBundle, origin: string, now: number): IcsCalendar {
	const { event } = bundle;
	const names = new Map(bundle.teams.map((team) => [team.number, team]));
	const times = matchTimes(bundle, now);
	const matches: IcsEvent[] = bundle.matches.flatMap((match) => {
		const at = times.get(match.key);
		if (!at) return [];
		const red = teamNumbers(match, 'red');
		const blue = teamNumbers(match, 'blue');
		const score = match.result ? ` (${match.result.red.total}–${match.result.blue.total})` : '';
		const url = `${origin}/events/${event.code}/matches/${match.key}`;
		return [
			{
				uid: matchUid(event.code, match.key),
				summary: `${match.label} red ${red.join(', ')} vs blue ${blue.join(', ')}${score}`,
				...zonedRange(at.start, matchEnd(at), event.timezone),
				description: [
					`${titleOf(match)} at ${event.name}.`,
					timing(match, at, event.timezone),
					`Red: ${joined(red.map((n) => teamName(names, n)))}.`,
					`Blue: ${joined(blue.map((n) => teamName(names, n)))}.`,
					scoreLine(match),
					url
				]
					.filter(Boolean)
					.join('\n'),
				location: location(event) || undefined,
				url,
				categories: ['FTC', match.level === 'qual' ? 'Qualification' : 'Playoff']
			}
		];
	});
	return {
		name: event.name,
		description: `FTC match schedule for ${event.name} from PitStop.`,
		timeZone: event.timezone,
		refreshMinutes: refreshMinutes([bundle], now),
		stamp: now,
		events: [eventEntry(event, [...times.values()], origin, []), ...matches]
	};
}

function outcomeText(match: Match, side: AllianceColor): string | null {
	const result = match.result;
	if (!result) return null;
	const other = opposite(side);
	const own = result[side].total;
	const theirs = result[other].total;
	if (result.winner === null) return `tied ${own}–${theirs}`;
	return `${result.winner === side ? 'won' : 'lost'} ${own}–${theirs}`;
}

function teamMatch(
	match: Match,
	at: MatchTime,
	bundle: EventBundle,
	team: number,
	origin: string
): IcsEvent | null {
	const side = sideOf(match, team);
	if (!side) return null;
	const { event } = bundle;
	const names = new Map(bundle.teams.map((entry) => [entry.number, entry]));
	const other = opposite(side);
	const partners = teamNumbers(match, side).filter((number) => number !== team);
	const opponents = teamNumbers(match, other);
	const outcome = outcomeText(match, side);
	const withText = partners.length > 0 ? ` with ${partners.join(', ')}` : '';
	const summary = outcome
		? `${team} ${match.label} ${outcome}${withText}`
		: `${team} ${match.label} on ${side}${withText}`;
	const url = `${origin}/events/${event.code}/matches/${match.key}`;
	const description = [
		`${titleOf(match)} at ${event.name}.`,
		timing(match, at, event.timezone),
		`Alliance: ${side}.`,
		partners.length > 0 ? `Partner: ${joined(partners.map((n) => teamName(names, n)))}.` : null,
		opponents.length > 0 ? `Opponents: ${joined(opponents.map((n) => teamName(names, n)))}.` : null,
		scoreLine(match),
		url
	];
	return {
		uid: matchUid(event.code, match.key, team),
		summary,
		...zonedRange(at.start, matchEnd(at), event.timezone),
		description: description.filter(Boolean).join('\n'),
		location: location(event) || undefined,
		url,
		categories: ['FTC', match.level === 'qual' ? 'Qualification' : 'Playoff']
	};
}

export function scheduleLikely(event: Pick<EventSummary, 'start' | 'timezone'>, now: number) {
	return addDays(event.start, -SCHEDULE_LEAD_DAYS) <= localDate(now, event.timezone);
}

function standing(entry: TeamSeason['events'][number]): string[] {
	const stats = entry.stats;
	if (!stats) return [];
	return [`Ranked ${ordinal(stats.rank)}, record ${stats.wins}-${stats.losses}-${stats.ties}.`];
}

export function teamCalendar(
	season: TeamSeason,
	bundles: Record<string, EventBundle | null>,
	origin: string,
	now: number
): IcsCalendar {
	const { team } = season;
	const teamUrl = `${origin}/teams/${team.number}`;
	const events = season.events.toSorted((a, b) => a.event.start.localeCompare(b.event.start));
	const entries: IcsEvent[] = [];
	for (const entry of events) {
		const bundle = bundles[entry.event.code] ?? null;
		const times = bundle ? matchTimes(bundle, now) : new Map<string, MatchTime>();
		const own = bundle
			? bundle.matches.flatMap((match) => {
					const at = times.get(match.key);
					const made = at ? teamMatch(match, at, bundle, team.number, origin) : null;
					return made && at ? [{ made, at }] : [];
				})
			: [];
		const summary = bundle?.event ?? entry.event;
		entries.push(
			eventEntry(
				summary,
				[...times.values()],
				origin,
				[`${team.number} ${team.name}.`, ...standing(entry), teamUrl],
				team.number
			),
			...own.map((item) => item.made)
		);
	}
	const zones = new Set(events.map((entry) => entry.event.timezone));
	return {
		name: `${team.number} ${team.name}`,
		description: `FTC events and matches for team ${team.number} ${team.name} from PitStop.`,
		timeZone: zones.size === 1 ? [...zones][0] : undefined,
		refreshMinutes: refreshMinutes(Object.values(bundles), now),
		stamp: now,
		events: entries
	};
}
