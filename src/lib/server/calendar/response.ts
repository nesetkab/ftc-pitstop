import type { CalendarFeed } from '#lib/server/calendar/load.ts';

export function calendarResponse(feed: CalendarFeed): Response {
	return new Response(feed.body, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `inline; filename="${feed.filename}"`,
			'cache-control': feed.cacheControl
		}
	});
}
