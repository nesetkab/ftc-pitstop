import { loadSeasonEvents } from '#lib/server/event.ts';
import { CACHE_CONTROL, errorResponse, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const list = await loadSeasonEvents();
		return jsonResponse(list, list.stale ? CACHE_CONTROL.short : CACHE_CONTROL.list);
	} catch (error) {
		return errorResponse(error, 'Event list is unavailable right now');
	}
};
