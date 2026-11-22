import { filterRows, parseFilters } from '#lib/components/team/leaderboard.ts';
import { SEASON } from '#lib/game/biobuzz.ts';
import { csvResponse, round, toCsv } from '#lib/server/csv.ts';
import { CACHE_CONTROL, jsonResponse } from '#lib/server/http.ts';
import { loadLeaderboardSource } from '../leaderboards/source.server.ts';
import type { RequestHandler } from './$types';

const HEADER = [
	'Rank',
	'Team',
	'Name',
	'City',
	'State',
	'Country',
	'Region',
	'OPR',
	'Auto',
	'Teleop',
	'Tips',
	'Matches',
	'Events'
];

export const GET: RequestHandler = async ({ url }) => {
	const filters = parseFilters(url.searchParams);
	const source = await loadLeaderboardSource().catch(() => null);
	if (!source) {
		return jsonResponse(
			{ error: 'Season ratings are still loading. Try again in a minute.' },
			CACHE_CONTROL.none,
			503
		);
	}
	const rows = filterRows(source.dataset.rows, filters);
	const body = toCsv(
		HEADER,
		rows.map((row, index) => [
			index + 1,
			row.team,
			row.name,
			row.city,
			row.state,
			row.country,
			row.region,
			round(row.opr),
			round(row.auto),
			round(row.teleop),
			round(row.tips),
			row.matches,
			row.events
		])
	);
	const name = ['leaderboard', SEASON, filters.region.toLowerCase(), filters.sort].filter(
		(part) => part && part !== 'opr'
	);
	return csvResponse(body, `${name.join('-')}.csv`, CACHE_CONTROL.short);
};
