import type { SeasonRatings } from '#lib/analysis/types.ts';
import type { EventStatus } from '#lib/components/event/dates.ts';
import {
	listStatus,
	regionLabels,
	type ListedEvent,
	type RegionBucket
} from '#lib/components/event/event-list.ts';
import { rosterFor, type Rosters } from '#lib/components/event/strength.ts';
import { ratedTeams } from '#lib/components/team/team-view.ts';
import { placeName } from '#lib/format/places.ts';
import { isCompetition } from '#lib/game/event-types.ts';
import type { EventSummary, SearchTeam } from '#lib/types.ts';

export const TOP_TEAMS = 10;

const CODE = /^[A-Z0-9]{2,12}$/;

export interface RegionTeam {
	team: number;
	name: string | null;
	place: string | null;
	opr: number;
	auto: number;
	teleop: number;
	matches: number;
	rank: number;
}

export interface RegionSummary {
	code: string;
	name: string;
	bucket: RegionBucket;
	teams: number;
	rated: number;
	events: number;
	done: number;
	live: number;
	upcoming: number;
	top: RegionTeam | null;
}

export interface Region {
	summary: RegionSummary;
	events: EventSummary[];
	teams: RegionTeam[];
}

export type RegionEvent = ListedEvent & { status: EventStatus };

export interface RegionInput {
	events: EventSummary[];
	rosters: Rosters | null;
	ratings: SeasonRatings | null;
	teams: SearchTeam[];
	finished: ReadonlySet<string>;
	now: number;
}

export function parseRegionCode(value: string | null | undefined): string | null {
	const code = value?.trim().toUpperCase() ?? '';
	return CODE.test(code) ? code : null;
}

function regionTeams(input: RegionInput): Map<string, RegionTeam[]> {
	const directory = new Map(input.teams.map((team) => [team.number, team]));
	const byRegion = new Map<string, RegionTeam[]>();
	const rated = ratedTeams(input.ratings).toSorted((a, b) => b.opr - a.opr || a.team - b.team);
	for (const rating of rated) {
		if (!rating.region) continue;
		const team = directory.get(rating.team);
		const list = byRegion.get(rating.region) ?? [];
		list.push({
			team: rating.team,
			name: team?.name ?? null,
			place: team ? placeName(team, 'short') || null : null,
			opr: rating.opr,
			auto: rating.parts.auto,
			teleop: rating.opr - rating.parts.auto,
			matches: rating.matches,
			rank: rating.rank
		});
		byRegion.set(rating.region, list);
	}
	return byRegion;
}

export function buildRegions(input: RegionInput): Map<string, Region> {
	const teams = regionTeams(input);
	const byRegion = new Map<string, EventSummary[]>();
	for (const event of input.events) {
		if (!event.region || !isCompetition(event.type)) continue;
		const list = byRegion.get(event.region) ?? [];
		list.push(event);
		byRegion.set(event.region, list);
	}
	const regions = new Map<string, Region>();
	for (const label of regionLabels(input.events)) {
		const events = byRegion.get(label.value) ?? [];
		const roster = new Set<number>();
		const counts = { done: 0, live: 0, upcoming: 0 };
		for (const event of events) {
			for (const team of rosterFor(event, input.rosters?.[event.code], input.now)) {
				roster.add(team);
			}
			counts[listStatus(event, input.now, input.finished)] += 1;
		}
		const rated = teams.get(label.value) ?? [];
		regions.set(label.value, {
			summary: {
				code: label.value,
				name: label.label,
				bucket: label.bucket,
				teams: roster.size,
				rated: rated.length,
				events: events.length,
				...counts,
				top: rated[0] ?? null
			},
			events,
			teams: rated.slice(0, TOP_TEAMS)
		});
	}
	return regions;
}

export function groupEvents(events: RegionEvent[]): Record<EventStatus, RegionEvent[]> {
	const byStart = (a: RegionEvent, b: RegionEvent) =>
		a.start.localeCompare(b.start) || a.name.localeCompare(b.name);
	return {
		live: events.filter((event) => event.status === 'live').sort(byStart),
		upcoming: events.filter((event) => event.status === 'upcoming').sort(byStart),
		done: events.filter((event) => event.status === 'done').sort((a, b) => byStart(b, a))
	};
}
