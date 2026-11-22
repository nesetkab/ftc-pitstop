import { eventStatus } from '#lib/components/event/dates.ts';
import { fixed } from '#lib/format/number.ts';
import { placeName } from '#lib/format/places.ts';
import { shortRange } from '#lib/format/time.ts';
import type { EventSummary, SearchTeam } from '#lib/types.ts';
import type { SearchResult } from '#lib/ui/search.svelte.ts';

type TeamHit = SearchTeam & { opr?: number; rank?: number };

const STATUS = { live: 'Live', upcoming: 'Upcoming', done: 'Done' } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isResult(value: unknown): value is SearchResult {
	return (
		isRecord(value) &&
		(value.type === 'team' || value.type === 'event') &&
		typeof value.label === 'string' &&
		typeof value.href === 'string'
	);
}

function isTeam(value: unknown): value is TeamHit {
	return isRecord(value) && typeof value.number === 'number' && typeof value.name === 'string';
}

function isEvent(value: unknown): value is EventSummary {
	return (
		isRecord(value) &&
		typeof value.code === 'string' &&
		typeof value.name === 'string' &&
		typeof value.start === 'string' &&
		typeof value.end === 'string'
	);
}

function teamMeta(team: TeamHit): string | null {
	if (typeof team.opr !== 'number' || typeof team.rank !== 'number') return null;
	return `${fixed(team.opr)} OPR · #${team.rank}`;
}

function teamResult(team: TeamHit): SearchResult {
	return {
		type: 'team',
		label: `${team.number} ${team.name}`,
		sublabel: placeName(team) || null,
		meta: teamMeta(team),
		href: `/teams/${team.number}`
	};
}

function eventResult(event: EventSummary, now: number): SearchResult {
	const parts = [event.code, placeName(event), shortRange(event.start, event.end)];
	const status = eventStatus(event, now);
	return {
		type: 'event',
		label: event.name,
		sublabel: parts.filter(Boolean).join(' · '),
		meta: STATUS[status],
		live: status === 'live',
		href: `/events/${event.code}`
	};
}

export function toSearchResults(body: unknown, now = Date.now()): SearchResult[] {
	if (Array.isArray(body)) return body.filter(isResult);
	if (!isRecord(body)) return [];
	if (Array.isArray(body.results)) return body.results.filter(isResult);
	const teams = Array.isArray(body.teams) ? body.teams.filter(isTeam) : [];
	const events = Array.isArray(body.events) ? body.events.filter(isEvent) : [];
	const teamResults = teams.map(teamResult);
	const eventResults = events.map((event) => eventResult(event, now));
	return body.lead === 'events'
		? [...eventResults, ...teamResults]
		: [...teamResults, ...eventResults];
}
