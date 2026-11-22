import { teamFeed } from '#lib/server/calendar/load.ts';
import { calendarResponse } from '#lib/server/calendar/response.ts';
import { loadEventBundle, loadTeamSeason } from '#lib/server/event.ts';
import { CACHE_CONTROL, errorResponse, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const feed = await teamFeed(
			{ loadTeamSeason, loadEventBundle },
			params.number,
			url.origin,
			Date.now()
		);
		if (!feed) return jsonResponse({ error: 'Team not found' }, CACHE_CONTROL.missing, 404);
		return calendarResponse(feed);
	} catch (error) {
		return errorResponse(error, 'The team calendar is unavailable right now');
	}
};
