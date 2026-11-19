import { loadTeamSeason } from '#lib/server/event.ts';
import { notFound } from '#lib/server/errors.ts';
import { CACHE_CONTROL, errorResponse, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const season = await loadTeamSeason(params.number);
		if (!season) throw notFound('Team not found');
		return jsonResponse(season, CACHE_CONTROL.short);
	} catch (error) {
		return errorResponse(error, 'Team data is unavailable right now');
	}
};
