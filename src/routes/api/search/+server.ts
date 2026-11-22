import type { SeasonRatings } from '#lib/analysis/types.ts';
import { loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { searchIndex } from '#lib/server/event.ts';
import { CACHE_CONTROL, errorResponse, jsonResponse } from '#lib/server/http.ts';
import { search, standingsOf, type TeamStanding } from '#lib/server/search.ts';
import type { RequestHandler } from './$types';

const standingsCache = new WeakMap<SeasonRatings, Map<number, TeamStanding>>();

async function standings(): Promise<Map<number, TeamStanding> | undefined> {
	const ratings = await loadSeasonRatingsWithin(400).catch(() => null);
	if (!ratings) return undefined;
	let found = standingsCache.get(ratings);
	if (!found) {
		found = standingsOf(ratings);
		standingsCache.set(ratings, found);
	}
	return found;
}

export const GET: RequestHandler = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').slice(0, 80);
	const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get('limit'))) || 10, 1), 25);
	if (!query.trim()) return jsonResponse({ teams: [], events: [] }, CACHE_CONTROL.list);
	try {
		const [index, ranked] = await Promise.all([searchIndex(), standings()]);
		return jsonResponse(search(index, query, limit, { standings: ranked }), CACHE_CONTROL.list);
	} catch (error) {
		return errorResponse(error, 'Search is unavailable right now');
	}
};
