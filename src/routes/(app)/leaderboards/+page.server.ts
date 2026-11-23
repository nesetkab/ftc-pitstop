import { error } from '@sveltejs/kit';
import {
	filterRows,
	leaderboardScope,
	paginate,
	parseFilters,
	teamPage,
	type LeaderboardFilters
} from '#lib/components/leaderboard/leaderboard.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { PageServerLoad } from './$types';
import { loadLeaderboardSource } from './source.server.ts';

const UNSCOPED = { type: '', dates: '', from: '', to: '' } as const;

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const parsed = parseFilters(url.searchParams);
	const today = new Date().toISOString().slice(0, 10);
	const scope = leaderboardScope(parsed, today);
	const source = await loadLeaderboardSource(scope, today).catch(() =>
		error(503, 'Season ratings are still loading. Try again in a minute.')
	);
	const filters: LeaderboardFilters = source.kind === 'scout' ? { ...parsed, ...UNSCOPED } : parsed;
	const { dataset } = source;
	const rows = filterRows(dataset.rows, filters);
	const found = filters.team > 0 ? teamPage(rows, filters.team) : null;
	const page = url.searchParams.has('page') ? filters.page : (found ?? filters.page);
	const result = paginate(rows, page);
	setHeaders({ 'cache-control': CACHE_CONTROL.short });
	return {
		source: source.kind,
		updated: source.updated,
		filters: { ...filters, page: result.page },
		window: source.kind === 'scout' ? null : scope.window,
		found: found !== null,
		rows: result.rows,
		total: result.total,
		page: result.page,
		pages: result.pages,
		start: result.start,
		population: dataset.rows.length,
		regions: dataset.regions,
		countries: dataset.countries,
		states: dataset.states[filters.country] ?? [],
		types: source.options.types,
		weeks: source.options.weeks
	};
};
