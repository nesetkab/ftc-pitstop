import {
	filterRecords,
	pageRecords,
	parseRecordFilters,
	RECORDS_CSV_LIMIT,
	recordQuery
} from '#lib/components/records/records.ts';
import { localDate } from '#lib/format/calendar.ts';
import { SEASON } from '#lib/game/biobuzz.ts';
import { toCsv } from '#lib/format/csv.ts';
import { canonicalRedirect } from '#lib/server/canonical.ts';
import { csvResponse } from '#lib/server/csv.ts';
import { CACHE_CONTROL, jsonResponse } from '#lib/server/http.ts';
import { loadRecordDataset, recordNames } from '#lib/server/records.ts';
import type { RequestHandler } from './$types';

const HEADER = [
	'Rank',
	'Total NP',
	'Auto',
	'Teleop',
	'Hive',
	'Flower',
	'Garden',
	'Park',
	'Tips',
	'Teams',
	'Team names',
	'Opponent NP',
	'Result',
	'Event code',
	'Event',
	'Date',
	'Match',
	'Level',
	'Alliance'
];

export const GET: RequestHandler = async ({ url }) => {
	const filters = parseRecordFilters(url.searchParams);
	const moved = canonicalRedirect(url, recordQuery({ ...filters, page: 1 }));
	if (moved) return moved;
	const source = await loadRecordDataset(20_000).catch(() => null);
	if (!source) {
		return jsonResponse(
			{ error: 'Season records are still loading. Try again in a minute.' },
			CACHE_CONTROL.none,
			503
		);
	}
	const sorted = filterRecords(source.dataset.rows, filters, localDate(Date.now(), 'UTC'));
	const { rows } = pageRecords(sorted, filters.part, 1, RECORDS_CSV_LIMIT);
	const names = await recordNames(
		rows.flatMap((row) => row.teams),
		rows.map((row) => row.event)
	);
	const body = toCsv(
		HEADER,
		rows.map((row) => [
			row.rank,
			row.total,
			row.auto,
			row.teleop,
			row.hive,
			row.flower,
			row.garden,
			row.park,
			row.tips,
			row.teams.join(' '),
			row.teams.map((team) => names.teams[team] ?? '').join(' / '),
			row.opponent,
			row.result,
			row.event,
			names.events[row.event] ?? '',
			row.day,
			row.label,
			row.level,
			row.alliance
		])
	);
	const name = ['records', SEASON, filters.part === 'total' ? '' : filters.part].filter(Boolean);
	return csvResponse(body, `${name.join('-')}.csv`, CACHE_CONTROL.ratings);
};
