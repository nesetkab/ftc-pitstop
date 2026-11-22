import { redirect } from '@sveltejs/kit';
import {
	buildComparison,
	compareHref,
	parseTeamList,
	sharedEventCodes,
	suggestNeighbors
} from '#lib/components/compare/compare.ts';
import { loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { loadEventBundle, loadTeamSeason } from '#lib/server/event.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { recordNames } from '#lib/server/records.ts';
import type { TeamSeason } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

async function settled<T>(task: Promise<T>): Promise<T | null> {
	try {
		return await task;
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const requested = url.searchParams.get('teams');
	const numbers = parseTeamList(requested, url.searchParams.get('add'));
	if (url.searchParams.has('add') || (requested !== null && requested !== numbers.join(','))) {
		redirect(303, compareHref(numbers));
	}

	const [found, ratings] = await Promise.all([
		Promise.all(numbers.map((number) => settled(loadTeamSeason(number)))),
		settled(loadSeasonRatingsWithin())
	]);
	const seasons = found.filter((season): season is TeamSeason => season !== null);
	const missing = numbers.filter((_, index) => found[index] === null);

	const codes = sharedEventCodes(seasons);
	const loaded = await Promise.all(codes.map((code) => settled(loadEventBundle(code))));
	const bundles = Object.fromEntries(codes.map((code, index) => [code, loaded[index]]));

	const view = buildComparison({ seasons, ratings, bundles });
	const present = seasons.map((season) => season.team.number);
	const suggestions = present.length < 2 ? suggestNeighbors(ratings, present) : [];
	const names = await recordNames(suggestions, []);

	setHeaders({ 'cache-control': CACHE_CONTROL.short });
	return {
		view,
		numbers: present,
		missing,
		suggestions: suggestions.map((number) => ({ number, name: names.teams[number] ?? null }))
	};
};
