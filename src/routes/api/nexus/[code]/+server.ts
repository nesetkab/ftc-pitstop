import { loadQueueStatus } from '#lib/server/event.ts';
import { CACHE_CONTROL, errorResponse, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const status = await loadQueueStatus(params.code);
		if (!status) {
			return jsonResponse({ error: 'This event is not using Nexus' }, CACHE_CONTROL.short, 404);
		}
		return jsonResponse(status, CACHE_CONTROL.queue);
	} catch (error) {
		return errorResponse(error, 'Queue status is unavailable right now');
	}
};
