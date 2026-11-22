import { eventFeed } from '#lib/server/calendar/load.ts';
import { calendarResponse } from '#lib/server/calendar/response.ts';
import { loadEventBundle } from '#lib/server/event.ts';
import { errorResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		return calendarResponse(
			await eventFeed({ loadEventBundle }, params.code, url.origin, Date.now())
		);
	} catch (error) {
		return errorResponse(error, 'The event calendar is unavailable right now');
	}
};
