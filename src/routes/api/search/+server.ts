import { searchIndex } from '#lib/server/event.ts';
import { CACHE_CONTROL, errorResponse, jsonResponse } from '#lib/server/http.ts';
import { search } from '#lib/server/search.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').slice(0, 80);
	const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get('limit'))) || 10, 1), 25);
	if (!query.trim()) return jsonResponse({ teams: [], events: [] }, CACHE_CONTROL.list);
	try {
		return jsonResponse(search(await searchIndex(), query, limit), CACHE_CONTROL.list);
	} catch (error) {
		return errorResponse(error, 'Search is unavailable right now');
	}
};
