import { eventStatus, statusLabel } from '#lib/components/event/dates.ts';
import { fixed } from '#lib/format/number.ts';
import { placeName } from '#lib/format/places.ts';
import { shortRange } from '#lib/format/time.ts';
import type { EventSummary, SearchTeam } from '#lib/types.ts';
import type { SearchResult } from '#lib/ui/search.svelte.ts';

type TeamHit = SearchTeam & { opr?: number; rank?: number };

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
	const place = placeName(team, 'short') || null;
	return {
		type: 'team',
		label: `${team.number} ${team.name}`,
		sublabel: place,
		meta: teamMeta(team),
		aside: place,
		href: `/teams/${team.number}`
	};
}

function eventResult(event: EventSummary, now: number): SearchResult {
	const dates = shortRange(event.start, event.end);
	const parts = [event.code, placeName(event, 'short'), dates];
	const status = eventStatus(event, now);
	const meta = statusLabel(event, status, now);
	return {
		type: 'event',
		label: event.name,
		sublabel: parts.filter(Boolean).join(' · '),
		meta,
		aside: status === 'live' ? meta : dates,
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

export async function searchApi(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
	const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
	if (!response.ok) return [];
	return toSearchResults(await response.json());
}
