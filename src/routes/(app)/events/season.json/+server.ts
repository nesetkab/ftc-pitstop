import { packEvents } from '#lib/components/event/event-list.ts';
import { CACHE_CONTROL, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';
import { loadEventList } from '../list.server.ts';

export const GET: RequestHandler = async () => {
	const list = await loadEventList();
	if (!list) {
		return jsonResponse(
			{ error: 'The event list is unavailable right now' },
			CACHE_CONTROL.none,
			503
		);
	}
	return jsonResponse(
		packEvents(list.events),
		list.stale ? CACHE_CONTROL.short : CACHE_CONTROL.list
	);
};
