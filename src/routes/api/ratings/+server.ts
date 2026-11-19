import { loadSeasonRatings } from '#lib/server/analysis.ts';
import { unavailable } from '#lib/server/errors.ts';
import { CACHE_CONTROL, errorResponse, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const ratings = await loadSeasonRatings();
		if (!ratings) throw unavailable('Season ratings are unavailable right now');
		return jsonResponse(ratings, CACHE_CONTROL.ratings);
	} catch (error) {
		return errorResponse(error, 'Season ratings are unavailable right now');
	}
};
