import type { Config } from '@sveltejs/adapter-vercel';
import { buildHomeEvents } from '#lib/components/team/home.ts';
import { loadEventsToday, loadSeasonEvents } from '#lib/server/event.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { PageServerLoad } from './$types';

export const config: Config = { isr: { expiration: 60 } };

export const load: PageServerLoad = async ({ setHeaders }) => {
	const [today, season] = await Promise.all([
		loadEventsToday().catch(() => null),
		loadSeasonEvents()
			.then((list) => list.events)
			.catch(() => null)
	]);
	setHeaders({ 'cache-control': CACHE_CONTROL.live });
	return buildHomeEvents({ today, season }, Date.now());
};
