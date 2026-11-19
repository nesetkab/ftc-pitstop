import { loadTeamRatingHistory } from '#lib/server/analysis.ts';
import { notFound } from '#lib/server/errors.ts';
import { CACHE_CONTROL, errorResponse, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const history = await loadTeamRatingHistory(params.number);
		if (!history) throw notFound('No ratings for this team this season');
		return jsonResponse(history, CACHE_CONTROL.ratings);
	} catch (error) {
		return errorResponse(error, 'Team ratings are unavailable right now');
	}
};
