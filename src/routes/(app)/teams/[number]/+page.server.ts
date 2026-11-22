import { error } from '@sveltejs/kit';
import { localDay } from '#lib/components/team/dates.ts';
import { buildTeamPage } from '#lib/components/team/team-view.ts';
import { loadEventAnalysis, loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { DataError } from '#lib/server/errors.ts';
import { loadEventBundle, loadTeamSeason } from '#lib/server/event.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { PageServerLoad } from './$types';

async function settled<T>(task: Promise<T>): Promise<T | null> {
	try {
		return await task;
	} catch {
		return null;
	}
}

function fail(cause: unknown): never {
	if (cause instanceof DataError) error(cause.status, cause.message);
	throw cause;
}

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const season = await loadTeamSeason(params.number).catch(fail);
	if (!season) error(404, 'Team not found');

	const now = Date.now();
	const started = season.events.filter(
		(entry) => entry.stats !== null && localDay(now, entry.event.timezone) >= entry.event.start
	);

	const [ratings, analysisList, bundleList] = await Promise.all([
		settled(loadSeasonRatingsWithin()),
		Promise.all(started.map((entry) => settled(loadEventAnalysis(entry.event.code)))),
		Promise.all(started.map((entry) => settled(loadEventBundle(entry.event.code))))
	]);

	const analyses = Object.fromEntries(
		started.map((entry, index) => [entry.event.code, analysisList[index]])
	);
	const bundles = Object.fromEntries(
		started.map((entry, index) => [entry.event.code, bundleList[index]])
	);

	setHeaders({ 'cache-control': CACHE_CONTROL.short });
	return { view: buildTeamPage({ season, ratings, analyses, bundles, now }) };
};
