import { error } from '@sveltejs/kit';
import {
	filterRecords,
	pageRecords,
	parseRecordFilters,
	recordQuery,
	type RecordRow
} from '#lib/components/records/records.ts';
import { localDate } from '#lib/format/calendar.ts';
import { LruMap } from '#lib/server/cache.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { loadRecordDataset, recordNames } from '#lib/server/records.ts';

const RECORDS_WAIT_MS = 6_000;

const sortedMemo = new WeakMap<RecordRow[], LruMap<RecordRow[]>>();

function sortedRows(rows: RecordRow[], key: string, sort: () => RecordRow[]): RecordRow[] {
	let memo = sortedMemo.get(rows);
	if (!memo) {
		memo = new LruMap<RecordRow[]>(24);
		sortedMemo.set(rows, memo);
	}
	const hit = memo.get(key);
	if (hit) return hit;
	const sorted = sort();
	memo.set(key, sorted);
	return sorted;
}

export async function loadRecordsPage(
	url: URL,
	setHeaders: (headers: Record<string, string>) => void
) {
	const filters = parseRecordFilters(url.searchParams);
	const source = await loadRecordDataset(RECORDS_WAIT_MS).catch(() => null);
	if (!source) error(503, 'Season records are still loading. Try again in a minute.');
	const { dataset } = source;
	const today = localDate(Date.now(), 'UTC');
	const sorted = sortedRows(dataset.rows, `${today}${recordQuery(filters, 1)}`, () =>
		filterRecords(dataset.rows, filters, today)
	);
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
}
