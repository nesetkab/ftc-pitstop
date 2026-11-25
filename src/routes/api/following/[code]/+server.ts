import { liveFeed } from '#lib/components/home/followed.ts';
import { loadEventBundle } from '#lib/server/event.ts';
import { errorResponse, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { cacheControl, ...bundle } = await loadEventBundle(params.code);
		return jsonResponse(liveFeed(bundle, Date.now()), cacheControl);
	} catch (error) {
		return errorResponse(error, 'Event data is unavailable right now');
	}
};
