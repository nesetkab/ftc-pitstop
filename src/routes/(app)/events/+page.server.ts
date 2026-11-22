import { error } from '@sveltejs/kit';
import { listed, regionGroups } from '#lib/components/event/event-list.ts';
import { finishedEvents, loadSeasonEvents } from '#lib/server/event.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { PageServerLoad } from './$types';
import { loadTeamCounts, teamCount } from './team-counts.server.ts';

export const load: PageServerLoad = async ({ setHeaders }) => {
	const [list, counts] = await Promise.all([
		loadSeasonEvents().catch(() => null),
		loadTeamCounts()
	]);
	if (!list) error(503, 'The event list is unavailable right now');
	setHeaders({ 'cache-control': CACHE_CONTROL.list });
	const now = Date.now();
	return {
		events: list.events.map((event) => listed(event, teamCount(event, counts?.[event.code], now))),
		regions: regionGroups(list.events),
		finished: finishedEvents(),
		fetchedAt: list.fetchedAt,
		stale: list.stale,
		renderedAt: now
	};
};
