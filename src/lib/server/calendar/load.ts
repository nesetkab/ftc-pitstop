import { eventCalendar, scheduleLikely, teamCalendar } from '#lib/server/calendar/feeds.ts';
import { renderCalendar } from '#lib/server/calendar/ics.ts';
import type { LoadedBundle } from '#lib/server/event.ts';
import { CACHE_CONTROL, shortestCache } from '#lib/server/http.ts';
import type { EventBundle, TeamSeason } from '#lib/types.ts';

export interface CalendarDeps {
	loadTeamSeason(number: string | number): Promise<TeamSeason | null>;
	loadEventBundle(code: string): Promise<LoadedBundle>;
}

export interface CalendarFeed {
	body: string;
	filename: string;
	cacheControl: string;
}

export async function eventFeed(
	deps: Pick<CalendarDeps, 'loadEventBundle'>,
	code: string,
	origin: string,
	now: number
): Promise<CalendarFeed> {
	const { cacheControl, ...bundle } = await deps.loadEventBundle(code);
	return {
		body: renderCalendar(eventCalendar(bundle, origin, now)),
		filename: `${bundle.event.code}.ics`,
		cacheControl
	};
}

export async function teamFeed(
	deps: CalendarDeps,
	number: string | number,
	origin: string,
	now: number
): Promise<CalendarFeed | null> {
	const season = await deps.loadTeamSeason(number);
	if (!season) return null;
	const codes = season.events
		.filter((entry) => scheduleLikely(entry.event, now))
		.map((entry) => entry.event.code);
	const loaded = await Promise.all(
		codes.map((code) => deps.loadEventBundle(code).catch(() => null))
	);
	const bundles: Record<string, EventBundle | null> = {};
	const caches: string[] = [];
	codes.forEach((code, index) => {
		const value = loaded[index];
		if (!value) {
			bundles[code] = null;
			return;
		}
		const { cacheControl, ...bundle } = value;
		bundles[code] = bundle;
		caches.push(cacheControl);
	});
	return {
		body: renderCalendar(teamCalendar(season, bundles, origin, now)),
		filename: `${season.team.number}.ics`,
		cacheControl: shortestCache(CACHE_CONTROL.short, ...caches)
	};
}
