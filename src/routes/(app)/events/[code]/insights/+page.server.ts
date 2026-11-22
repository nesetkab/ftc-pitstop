import {
	INSIGHT_LIMIT,
	parseInsightFilters,
	partAverages,
	partHighs,
	rankInsights,
	sortInsights
} from '#lib/components/event/insights.ts';
import { loadInsightRows } from '#lib/server/insights.ts';
import { loadSeasonAverages } from '#lib/server/records.ts';
import type { PageServerLoad } from './$types';

const SEASON_WAIT_MS = 1500;

export const load: PageServerLoad = async ({ params, url }) => {
	const filters = parseInsightFilters(url.searchParams);
	const [source, season] = await Promise.all([
		loadInsightRows(params.code).catch(() => null),
		loadSeasonAverages(SEASON_WAIT_MS).catch(() => null)
	]);
	const rows = source?.rows ?? [];
	const ranked = rankInsights(sortInsights(rows, filters), filters.sort);
	return {
		filters,
		rows: filters.all ? ranked : ranked.slice(0, INSIGHT_LIMIT),
		total: ranked.length,
		averages: {
			qual: partAverages(rows.filter((row) => row.level === 'qual')),
			playoff: partAverages(rows.filter((row) => row.level === 'playoff')),
			event: partAverages(rows),
			high: partHighs(rows),
			season
		}
	};
};
