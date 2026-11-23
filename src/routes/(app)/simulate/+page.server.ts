import { redirect } from '@sveltejs/kit';
import { isCanonical, parseSides, simulateHref } from '#lib/components/simulate/simulate.ts';
import { loadSeasonModelWithin } from '#lib/server/analysis.ts';
import { recordNames } from '#lib/server/records.ts';
import { createSimulate } from '#lib/server/simulate.ts';
import type { PageServerLoad } from './$types';

const loadSimulation = createSimulate({
	loadSeasonModelWithin: () => loadSeasonModelWithin(),
	recordNames: (teams, events) => recordNames(teams, events)
});

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const sides = parseSides(url.searchParams);
	if (!isCanonical(url.searchParams, sides)) redirect(303, simulateHref(sides));

	const { cacheControl, ...data } = await loadSimulation(sides);
	setHeaders({ 'cache-control': cacheControl });
	return data;
};
