import { error } from '@sveltejs/kit';
import { localDate } from '#lib/format/calendar.ts';
import { upcomingEntries } from '#lib/components/team/season-report.ts';
import { buildTeamPage } from '#lib/components/team/team-view.ts';
import { loadEventAnalysis, loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { settleWithin } from '#lib/server/cache.ts';
import { DataError } from '#lib/server/errors.ts';
import { loadAwardHistory, loadEventBundle, loadTeamSeason } from '#lib/server/event.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { EventBundle } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

async function settled<T>(task: Promise<T>): Promise<T | null> {
	try {
		return await task;
	} catch {
		return null;
	}
}

const AHEAD_WAIT_MS = 2500;
const HISTORY_WAIT_MS = 2500;

async function lookAhead(code: string) {
	const bundle = await settled(loadEventBundle(code));
	const analysis = scheduled(bundle) ? await settled(loadEventAnalysis(code)) : null;
	return { bundle, analysis };
}

function scheduled(bundle: EventBundle | null): boolean {
	return bundle?.matches.some((match) => match.level === 'qual' && !match.result) ?? false;
}

function fail(cause: unknown): never {
	if (cause instanceof DataError) error(cause.status, cause.message);
	throw cause;
}

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const ratingsTask = settled(loadSeasonRatingsWithin());
	const season = await loadTeamSeason(params.number).catch(fail);
	if (!season) error(404, 'Team not found');

	const now = Date.now();
	const started = season.events.filter(
		(entry) => entry.stats !== null && localDate(now, entry.event.timezone) >= entry.event.start
	);

	const startedCodes = new Set(started.map((entry) => entry.event.code));
	const ahead = upcomingEntries(season, now).filter((entry) => !startedCodes.has(entry.event.code));

	const [history, ratings, analysisList, bundleList, aheadList] = await Promise.all([
		settleWithin(loadAwardHistory(season.team.number, season.team.rookieYear), HISTORY_WAIT_MS),
		ratingsTask,
		Promise.all(started.map((entry) => settled(loadEventAnalysis(entry.event.code)))),
		Promise.all(started.map((entry) => settled(loadEventBundle(entry.event.code)))),
		Promise.all(ahead.map((entry) => settleWithin(lookAhead(entry.event.code), AHEAD_WAIT_MS)))
	]);

	const analyses = Object.fromEntries([
		...started.map((entry, index) => [entry.event.code, analysisList[index]] as const),
		...ahead.map((entry, index) => [entry.event.code, aheadList[index]?.analysis ?? null] as const)
	]);
	const bundles = Object.fromEntries([
		...started.map((entry, index) => [entry.event.code, bundleList[index]] as const),
		...ahead.map((entry, index) => [entry.event.code, aheadList[index]?.bundle ?? null] as const)
	]);

	setHeaders({ 'cache-control': CACHE_CONTROL.short });
	return { view: buildTeamPage({ season, history, ratings, analyses, bundles, now }) };
};
