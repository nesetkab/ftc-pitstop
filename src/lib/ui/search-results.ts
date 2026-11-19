import { dateRange } from '#lib/format/index.ts';
import type { EventSummary, SearchTeam } from '#lib/types.ts';
import type { SearchResult } from '#lib/ui/search.svelte.ts';
import { placeName } from '#lib/components/team/places.ts';

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

function isTeam(value: unknown): value is SearchTeam {
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

function teamResult(team: SearchTeam): SearchResult {
	return {
		type: 'team',
		label: `${team.number} ${team.name}`,
		sublabel: placeName(team) || null,
		href: `/teams/${team.number}`
	};
}

function eventResult(event: EventSummary): SearchResult {
	const place = placeName(event);
	const parts = [event.code, place, dateRange(event.start, event.end)].filter(Boolean);
	return {
		type: 'event',
		label: event.name,
		sublabel: `${parts.join('. ')}.`,
		href: `/events/${event.code}`
	};
}

export function toSearchResults(body: unknown): SearchResult[] {
	if (Array.isArray(body)) return body.filter(isResult);
	if (!isRecord(body)) return [];
	if (Array.isArray(body.results)) return body.results.filter(isResult);
	const teams = Array.isArray(body.teams) ? body.teams.filter(isTeam) : [];
	const events = Array.isArray(body.events) ? body.events.filter(isEvent) : [];
	return [...teams.map(teamResult), ...events.map(eventResult)];
}
