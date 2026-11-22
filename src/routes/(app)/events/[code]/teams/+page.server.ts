import { loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { CACHE_CONTROL, shortestCache } from '#lib/server/http.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, setHeaders }) => {
	const [{ bundle, cacheControl }, ratings] = await Promise.all([
		parent(),
		loadSeasonRatingsWithin().catch(() => null)
	]);
	const rated = ratings !== null && ratings.teams.length > 0;
	setHeaders({
		'cache-control': shortestCache(cacheControl, rated ? CACHE_CONTROL.ratings : CACHE_CONTROL.live)
	});
	if (!rated) return { season: null, seasonCount: null };
	const here = new Set(bundle.teams.map((team) => team.number));
	const season: Record<number, { opr: number; rank: number }> = {};
	for (const rating of ratings.teams) {
		if (here.has(rating.team)) season[rating.team] = { opr: rating.opr, rank: rating.rank };
	}
	return { season, seasonCount: ratings.teams.length };
};
