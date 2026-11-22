import { error } from '@sveltejs/kit';
import { filterRows, paginate, parseFilters, teamPage } from '#lib/components/team/leaderboard.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { PageServerLoad } from './$types';
import { loadLeaderboardSource } from './source.server.ts';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const filters = parseFilters(url.searchParams);
	const source = await loadLeaderboardSource().catch(() =>
		error(503, 'Season ratings are still loading. Try again in a minute.')
	);
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
		found: found !== null,
		rows: result.rows,
		total: result.total,
		page: result.page,
		pages: result.pages,
		start: result.start,
		population: dataset.rows.length,
		regions: dataset.regions,
		countries: dataset.countries,
		states: dataset.states[filters.country] ?? []
	};
};
