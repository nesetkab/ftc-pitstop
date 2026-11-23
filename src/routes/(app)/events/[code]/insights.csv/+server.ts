import { parseInsightFilters, rankInsights, sortInsights } from '#lib/components/event/insights.ts';
import { toCsv } from '#lib/format/csv.ts';
import { csvResponse } from '#lib/server/csv.ts';
import { errorResponse } from '#lib/server/http.ts';
import { loadInsightRows } from '#lib/server/insights.ts';
import type { RequestHandler } from './$types';

const HEADER = [
	'Rank',
	'Match',
	'Level',
	'Alliance',
	'Teams',
	'Result',
	'Total NP',
	'Auto',
	'Teleop',
	'Hive',
	'Flower',
	'Garden',
	'Park',
	'Tips',
	'Opponent NP'
];

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const filters = parseInsightFilters(url.searchParams);
		const { event, rows, cacheControl } = await loadInsightRows(params.code);
		const ranked = rankInsights(sortInsights(rows, filters), filters.sort);
		const body = toCsv(
			HEADER,
			ranked.map((row) => [
				row.rank,
				row.label,
				row.level,
				row.alliance,
				row.teams.join(' '),
				row.result,
				row.total,
				row.auto,
				row.teleop,
				row.hive,
				row.flower,
				row.garden,
				row.park,
				row.tips,
				row.opponent
			])
		);
		const suffix = [filters.level, filters.sort === 'total' ? '' : filters.sort].filter(Boolean);
		const name = [event.code, 'insights', ...suffix].join('-');
		return csvResponse(body, `${name}.csv`, cacheControl);
	} catch (error) {
		return errorResponse(error, 'Event scores are unavailable right now');
	}
};
