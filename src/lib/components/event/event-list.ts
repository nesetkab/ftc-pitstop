import { dateRange } from '#lib/format/time.ts';
import type { EventSummary, EventType } from '#lib/types.ts';
import { addDays, localDate, weekStart } from '#lib/format/calendar.ts';
import { eventStatus, type EventStatus } from './dates.ts';
import { TYPE_ORDER } from './event-meta.ts';
import { areaName, isUnitedStates, knownRegion, placeName } from '#lib/format/places.ts';

export type ListedEvent = {
	code: string;
	name: string;
	type: EventType;
	region: string | null;
	place: string | null;
	timezone: string;
	start: string;
	end: string;
	teams: number | null;
	strength: number | null;
};

export function listed(
	event: EventSummary,
	teams: number | null,
	strength: number | null = null
): ListedEvent {
	return {
		code: event.code,
		name: event.name,
		type: event.type,
		region: event.region,
		place: placeName(event) || null,
		timezone: event.timezone,
		start: event.start,
		end: event.end,
		teams,
		strength
	};
}

export type PackedEvent = [
	code: string,
	name: string,
	type: number,
	region: number | null,
	place: string | null,
	timezone: number,
	start: string,
	days: number,
	teams: number | null,
	strength: number | null
];

export type PackedEvents = { words: string[]; rows: PackedEvent[] };

const DAY_MS = 86_400_000;

function dayGap(start: string, end: string): number {
	return Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS);
}

export function packEvents(events: ListedEvent[]): PackedEvents {
	const words: string[] = [];
	const index = new Map<string, number>();
	const word = (text: string) => {
		let at = index.get(text);
		if (at === undefined) {
			at = words.push(text) - 1;
			index.set(text, at);
		}
		return at;
	};
	const rows = events.map((event): PackedEvent => [
		event.code,
		event.name,
		word(event.type),
		event.region === null ? null : word(event.region),
		event.place,
		word(event.timezone),
		event.start,
		dayGap(event.start, event.end),
		event.teams,
		event.strength
	]);
	return { words, rows };
}

export function unpackEvents({ words, rows }: PackedEvents): ListedEvent[] {
	return rows.map(([code, name, type, region, place, timezone, start, days, teams, strength]) => ({
		code,
		name,
		type: words[type] as EventType,
		region: region === null ? null : words[region],
		place,
		timezone: words[timezone],
		start,
		end: days === 0 ? start : addDays(start, days),
		teams,
		strength
	}));
}

export type DateFilter = 'week' | 'upcoming' | 'past' | 'all';

export type EventFilters = {
	query: string;
	region: string;
	type: string;
	when: DateFilter;
};

export type WeekGroup = {
	start: string;
	label: string;
	current: boolean;
	events: (ListedEvent & { status: EventStatus })[];
};

export type RegionGroup = {
	label: string;
	options: { value: string; label: string }[];
};

function normalize(text: string): string {
	return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function haystack(event: ListedEvent): string {
	return normalize(
		[event.name, event.code, event.place, event.region, knownRegion(event.region)]
			.filter(Boolean)
			.join(' ')
	);
}

const searchText = new WeakMap<ListedEvent, string>();

function textOf(event: ListedEvent): string {
	const cached = searchText.get(event);
	if (cached !== undefined) return cached;
	const text = haystack(event);
	searchText.set(event, text);
	return text;
}

function matchesQuery(event: ListedEvent, words: string[]): boolean {
	if (words.length === 0) return true;
	const text = textOf(event);
	return words.every((word) => text.includes(word));
}

export function viewerToday(now: number): string {
	return localDate(now, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
}

export function currentWeek(now: number): { start: string; end: string } {
	const start = weekStart(viewerToday(now));
	return { start, end: addDays(start, 6) };
}

export function listStatus(
	event: ListedEvent,
	now: number,
	finished: ReadonlySet<string> = new Set()
): EventStatus {
	const status = eventStatus(event, now);
	return status === 'live' && finished.has(event.code) ? 'done' : status;
}

export function filterEvents(
	events: ListedEvent[],
	filters: EventFilters,
	now: number,
	finished: ReadonlySet<string> = new Set()
): (ListedEvent & { status: EventStatus })[] {
	const words = normalize(filters.query).split(/\s+/).filter(Boolean);
	const week = currentWeek(now);
	const list = events.flatMap((event) => {
		if (filters.region && event.region !== filters.region) return [];
		if (filters.type && event.type !== filters.type) return [];
		if (!matchesQuery(event, words)) return [];
		const status = listStatus(event, now, finished);
		if (filters.when === 'week' && (event.start > week.end || event.end < week.start)) return [];
		if (filters.when === 'upcoming' && status === 'done') return [];
		if (filters.when === 'past' && status !== 'done') return [];
		return [{ ...event, status }];
	});
	const ascending = (a: ListedEvent, b: ListedEvent) =>
		a.start.localeCompare(b.start) || a.name.localeCompare(b.name);
	return list.sort(filters.when === 'past' ? (a, b) => ascending(b, a) : ascending);
}

export function groupByWeek(
	events: (ListedEvent & { status: EventStatus })[],
	now: number
): WeekGroup[] {
	const current = currentWeek(now).start;
	const groups: WeekGroup[] = [];
	for (const event of events) {
		const start = weekStart(event.start);
		let group = groups.at(-1);
		if (!group || group.start !== start) {
			group = {
				start,
				label: dateRange(start, addDays(start, 6)),
				current: start === current,
				events: []
			};
			groups.push(group);
		}
		group.events.push(event);
	}
	return groups;
}

export function regionGroups(events: EventSummary[]): RegionGroup[] {
	const regions = new Map<string, { areas: Map<string, number>; us: boolean; canada: boolean }>();
	for (const event of events) {
		if (!event.region) continue;
		const entry = regions.get(event.region) ?? { areas: new Map(), us: false, canada: false };
		const area = areaName(event.state, event.country);
		if (area) entry.areas.set(area, (entry.areas.get(area) ?? 0) + 1);
		if (isUnitedStates(event.country)) entry.us = true;
		if (event.country === 'Canada') entry.canada = true;
		regions.set(event.region, entry);
	}
	const groups: Record<'us' | 'canada' | 'other', { value: string; label: string }[]> = {
		us: [],
		canada: [],
		other: []
	};
	for (const [code, entry] of regions) {
		const names = [...entry.areas.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
		const shown = names.slice(0, 3).join(', ');
		const label =
			knownRegion(code) ??
			(shown ? `${shown}${names.length > 3 ? ' and more' : ''} (${code})` : code);
		const bucket = entry.us ? 'us' : entry.canada ? 'canada' : 'other';
		groups[bucket].push({ value: code, label });
	}
	const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);
	return [
		{ label: 'United States', options: groups.us.sort(byLabel) },
		{ label: 'Canada', options: groups.canada.sort(byLabel) },
		{ label: 'Other countries', options: groups.other.sort(byLabel) }
	].filter((group) => group.options.length > 0);
}

export function typeOptions(events: ListedEvent[]): EventType[] {
	const present = new Set(events.map((event) => event.type));
	return TYPE_ORDER.filter((type) => present.has(type));
}
