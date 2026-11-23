import { error } from '@sveltejs/kit';
import {
	firstPage,
	packEvents,
	regionGroups,
	typeOptions,
	PAGE_SIZE
} from '#lib/components/event/event-list.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { PageServerLoad } from './$types';
import { loadEventList } from './list.server.ts';

const FULL = new Set(['past', 'all']);

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const list = await loadEventList();
	if (!list) error(503, 'The event list is unavailable right now');
	setHeaders({ 'cache-control': CACHE_CONTROL.list });
	const params = url.searchParams;
	const complete =
		FULL.has(params.get('when') ?? '') || ['q', 'region', 'type'].some((key) => params.get(key));
	const page = complete
		? null
		: firstPage(list.events, list.now, new Set(list.finished), PAGE_SIZE);
	return {
		events: packEvents(page?.events ?? list.events),
		window: page?.window ?? null,
		total: list.events.length,
		types: typeOptions(list.events),
		regions: regionGroups(list.summaries),
		finished: list.finished,
		fetchedAt: list.fetchedAt,
		stale: list.stale,
		renderedAt: list.now
	};
};
