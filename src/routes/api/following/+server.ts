import { parseTeamList, teamListQuery } from '#lib/components/home/followed.ts';
import { canonicalRedirect } from '#lib/server/canonical.ts';
import { loadFollowed } from '#lib/server/home.ts';
import { CACHE_CONTROL, errorResponse, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const teams = parseTeamList(url.searchParams.get('teams'));
	const moved = canonicalRedirect(url, teams.length > 0 ? `?teams=${teamListQuery(teams)}` : '');
	if (moved) return moved;
	if (teams.length === 0) return jsonResponse({ teams: [] }, CACHE_CONTROL.list);
	try {
		return jsonResponse({ teams: await loadFollowed(teams) }, CACHE_CONTROL.short);
	} catch (error) {
		return errorResponse(error, 'Team data is unavailable right now');
	}
};
