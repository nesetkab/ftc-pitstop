import {
	filterRows,
	leaderboardScope,
	parseFilters,
	queryString
} from '#lib/components/leaderboard/leaderboard.ts';
import { SEASON } from '#lib/game/biobuzz.ts';
import { round, toCsv } from '#lib/format/csv.ts';
import { canonicalRedirect } from '#lib/server/canonical.ts';
import { csvResponse } from '#lib/server/csv.ts';
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
	const moved = canonicalRedirect(url, queryString({ ...filters, team: 0 }, 1));
	if (moved) return moved;
	const today = new Date().toISOString().slice(0, 10);
	const scope = leaderboardScope(filters, today);
	const source = await loadLeaderboardSource(scope, today).catch(() => null);
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
	const window = source.kind === 'ratings' ? scope.window : null;
	const name = [
		'leaderboard',
		SEASON,
		filters.region.toLowerCase(),
		source.kind === 'ratings' ? filters.type.toLowerCase() : '',
		filters.dates || (window ? `${filters.from || 'start'}-to-${filters.to || 'now'}` : ''),
		filters.sort
	].filter((part) => part && part !== 'opr');
	return csvResponse(body, `${name.join('-')}.csv`, CACHE_CONTROL.short);
};
