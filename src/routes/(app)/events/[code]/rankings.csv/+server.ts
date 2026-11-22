import { npMax } from '#lib/components/event/insights.ts';
import { loadEventAnalysisEntry } from '#lib/server/analysis.ts';
import { csvResponse, round, toCsv } from '#lib/server/csv.ts';
import { loadEventBundle } from '#lib/server/event.ts';
import { CACHE_CONTROL, errorResponse, shortestCache } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

const HEADER = [
	'Rank',
	'Team',
	'Name',
	'RS',
	'TBP',
	'NP max',
	'Avg tips',
	'Wins',
	'Losses',
	'Ties',
	'Played',
	'OPR'
];

export const GET: RequestHandler = async ({ params }) => {
	try {
		const [{ cacheControl, ...bundle }, entry] = await Promise.all([
			loadEventBundle(params.code),
			loadEventAnalysisEntry(params.code).catch(() => null)
		]);
		const names = new Map(bundle.teams.map((team) => [team.number, team.name]));
		const best = npMax(bundle.matches);
		const opr = new Map(entry?.analysis.ratings.map((rating) => [rating.team, rating.opr]));
		const rows = bundle.rankings.map((row) => [
			row.rank,
			row.team,
			names.get(row.team) ?? row.name ?? '',
			round(row.rs),
			round(row.tbp),
			best.get(row.team),
			round(row.avgTips),
			row.wins,
			row.losses,
			row.ties,
			row.played,
			round(opr.get(row.team), 1)
		]);
		return csvResponse(
			toCsv(HEADER, rows),
			`${bundle.event.code}-rankings.csv`,
			shortestCache(cacheControl, entry?.cacheControl ?? CACHE_CONTROL.live)
		);
	} catch (error) {
		return errorResponse(error, 'Rankings are unavailable right now');
	}
};
