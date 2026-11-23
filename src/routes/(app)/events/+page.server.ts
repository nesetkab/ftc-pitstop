import { error } from '@sveltejs/kit';
import { eventStatus } from '#lib/components/event/dates.ts';
import { listed, packEvents, regionGroups } from '#lib/components/event/event-list.ts';
import { finishedEvents, loadSeasonEvents } from '#lib/server/event.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { loadStrengthWithin } from '#lib/server/strength.ts';
import type { PageServerLoad } from './$types';
import { loadTeamCounts, teamCount } from './team-counts.server.ts';

export const load: PageServerLoad = async ({ setHeaders }) => {
	const [list, counts, strength] = await Promise.all([
		loadSeasonEvents().catch(() => null),
		loadTeamCounts(),
		loadStrengthWithin()
	]);
	if (!list) error(503, 'The event list is unavailable right now');
	setHeaders({ 'cache-control': CACHE_CONTROL.list });
	const now = Date.now();
	const live = new Set(
		list.events.filter((event) => eventStatus(event, now) === 'live').map((event) => event.code)
	);
	return {
		events: packEvents(
			list.events.map((event) =>
				listed(
					event,
					teamCount(event, counts?.[event.code], now),
					strength?.events.get(event.code)?.top ?? null
				)
			)
		),
		regions: regionGroups(list.events),
		finished: finishedEvents().filter((code) => live.has(code)),
		fetchedAt: list.fetchedAt,
		stale: list.stale,
		renderedAt: now
	};
};
