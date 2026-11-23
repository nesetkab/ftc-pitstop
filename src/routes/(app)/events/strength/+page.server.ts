import { error } from '@sveltejs/kit';
import { listed, packEvents, regionGroups } from '#lib/components/event/event-list.ts';
import { strengthDetail } from '#lib/components/event/strength.ts';
import { loadSeasonEvents } from '#lib/server/event.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { loadStrengthWithin } from '#lib/server/strength.ts';
import type { PageServerLoad } from './$types';

const WAIT_MS = 4_000;

export const load: PageServerLoad = async ({ setHeaders }) => {
	const [list, strength] = await Promise.all([
		loadSeasonEvents().catch(() => null),
		loadStrengthWithin(WAIT_MS)
	]);
	if (!list) error(503, 'The event list is unavailable right now');
	setHeaders({ 'cache-control': strength ? CACHE_CONTROL.list : CACHE_CONTROL.short });
	const ranked = list.events.flatMap((event) => {
		const entry = strength?.events.get(event.code);
		return entry && entry.top !== null ? [{ event, entry }] : [];
	});
	return {
		events: packEvents(ranked.map(({ event, entry }) => listed(event, entry.teams, entry.top))),
		details: ranked.map(({ entry }) => strengthDetail(entry)),
		regions: regionGroups(ranked.map(({ event }) => event)),
		total: strength?.total ?? 0,
		updated: strength?.ratingsAt ?? null,
		renderedAt: Date.now()
	};
};
