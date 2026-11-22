import { withoutBreakdowns } from '#lib/game/breakdowns.ts';
import { loadEventBundle } from '#lib/server/event.ts';
import { errorResponse, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { cacheControl, ...bundle } = await loadEventBundle(params.code);
		return jsonResponse(withoutBreakdowns(bundle), cacheControl);
	} catch (error) {
		return errorResponse(error, 'Event data is unavailable right now');
	}
};
