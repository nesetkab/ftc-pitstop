import {
	availableSources,
	csvDigits,
	csvHeader,
	csvValues,
	parseRankingChoice,
	rankingRows,
	scoreStats,
	sortRankingRows,
	visibleColumns
} from '#lib/components/event/ranking-columns.ts';
import { loadEventAnalysisEntry } from '#lib/server/analysis.ts';
import { round, toCsv } from '#lib/format/csv.ts';
import { csvResponse } from '#lib/server/csv.ts';
import { loadEventBundle } from '#lib/server/event.ts';
import { CACHE_CONTROL, errorResponse, shortestCache } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const [{ cacheControl, ...bundle }, entry] = await Promise.all([
			loadEventBundle(params.code),
			loadEventAnalysisEntry(params.code).catch(() => null)
		]);
		const choice = parseRankingChoice(url.searchParams);
		const names = new Map(bundle.teams.map((team) => [team.number, team.name]));
		const ratings = entry?.analysis.ratings ?? null;
		const stats = scoreStats(bundle.matches);
		const columns = visibleColumns(choice, availableSources(ratings, stats));
		const digits = csvDigits(columns);
		const rows = sortRankingRows(rankingRows(bundle.rankings, ratings, stats, null), choice).map(
			(row) => [
				row.ranking.rank,
				row.ranking.team,
				names.get(row.ranking.team) ?? row.ranking.name ?? '',
				...csvValues(columns, row).map((value, index) => round(value, digits[index] + 1))
			]
		);
		return csvResponse(
			toCsv(['Rank', 'Team', 'Name', ...csvHeader(columns)], rows),
			`${bundle.event.code}-rankings.csv`,
			shortestCache(cacheControl, entry?.cacheControl ?? CACHE_CONTROL.live)
		);
	} catch (error) {
		return errorResponse(error, 'Rankings are unavailable right now');
	}
};
