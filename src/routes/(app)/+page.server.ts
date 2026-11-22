import { buildHomeEvents } from '#lib/components/team/home.ts';
import { loadEventsToday, loadSeasonEvents } from '#lib/server/event.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { loadRecentRecords } from '#lib/server/records.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
	const [today, season, records] = await Promise.all([
		loadEventsToday().catch(() => null),
		loadSeasonEvents()
			.then((list) => list.events)
			.catch(() => null),
		loadRecentRecords(5, 1000).catch(() => null)
	]);
	setHeaders({ 'cache-control': CACHE_CONTROL.live });
	return { ...buildHomeEvents({ today, season }, Date.now()), records };
};
