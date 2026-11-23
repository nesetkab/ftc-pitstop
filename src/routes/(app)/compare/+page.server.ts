import { redirect } from '@sveltejs/kit';
import { compareHref, parseTeamList } from '#lib/components/compare/compare.ts';
import { loadSeasonModelWithin, loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { createCompare } from '#lib/server/compare.ts';
import { loadTeamSeason } from '#lib/server/event.ts';
import { recordNames } from '#lib/server/records.ts';
import type { PageServerLoad } from './$types';

const loadComparison = createCompare({
	loadTeamSeason: (number) => loadTeamSeason(number),
	loadSeasonRatingsWithin: () => loadSeasonRatingsWithin(),
	loadSeasonModelWithin: () => loadSeasonModelWithin(),
	recordNames: (teams, events) => recordNames(teams, events)
});

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const requested = url.searchParams.get('teams');
	const numbers = parseTeamList(requested, url.searchParams.get('add'));
	if (url.searchParams.has('add') || (requested !== null && requested !== numbers.join(','))) {
		redirect(303, compareHref(numbers));
	}

	const { cacheControl, ...data } = await loadComparison(numbers);
	setHeaders({ 'cache-control': cacheControl });
	return data;
};
