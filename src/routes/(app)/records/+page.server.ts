import { error } from '@sveltejs/kit';
import { filterRecords, pageRecords, parseRecordFilters } from '#lib/components/records/records.ts';
import { localDay } from '#lib/components/team/dates.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { loadRecordDataset, recordNames } from '#lib/server/records.ts';
import type { PageServerLoad } from './$types';

const RECORDS_WAIT_MS = 6_000;

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const filters = parseRecordFilters(url.searchParams);
	const source = await loadRecordDataset(RECORDS_WAIT_MS).catch(() => null);
	if (!source) error(503, 'Season records are still loading. Try again in a minute.');
	const { dataset } = source;
	const sorted = filterRecords(dataset.rows, filters, localDay(Date.now(), 'UTC'));
	const result = pageRecords(sorted, filters.part, filters.page);
	const names = await recordNames(
		[...result.rows.flatMap((row) => row.teams), ...(filters.team ? [filters.team] : [])],
		result.rows.map((row) => row.event)
	);
	setHeaders({ 'cache-control': CACHE_CONTROL.ratings });
	return {
		updated: source.updated,
		filters: { ...filters, page: result.page },
		rows: result.rows,
		total: result.total,
		page: result.page,
		pages: result.pages,
		start: result.start,
		regions: dataset.regions,
		types: dataset.types,
		names
	};
};
