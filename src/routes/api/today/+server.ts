import { loadEventsToday } from '#lib/server/event.ts';
import { CACHE_CONTROL, errorResponse, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		return jsonResponse({ events: await loadEventsToday() }, CACHE_CONTROL.short);
	} catch (error) {
		return errorResponse(error, 'Event list is unavailable right now');
	}
};
