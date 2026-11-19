import { error } from '@sveltejs/kit';
import type { Config } from '@sveltejs/adapter-vercel';
import { listed, regionGroups } from '#lib/components/event/event-list.ts';
import { loadSeasonEvents } from '#lib/server/event.ts';
import type { PageServerLoad } from './$types';
import { loadTeamCounts } from './team-counts.server.ts';

export const config: Config = { isr: { expiration: 300 } };

export const load: PageServerLoad = async () => {
	const [list, counts] = await Promise.all([
		loadSeasonEvents().catch(() => null),
		loadTeamCounts()
	]);
	if (!list) error(503, 'The event list is unavailable right now');
	return {
		events: list.events.map((event) => listed(event, counts?.[event.code] || null)),
		regions: regionGroups(list.events),
		fetchedAt: list.fetchedAt,
		stale: list.stale,
		renderedAt: Date.now()
	};
};
