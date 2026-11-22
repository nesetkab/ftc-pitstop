import { parseTeamList } from '#lib/components/home/followed.ts';
import { loadFollowed } from '#lib/server/home.ts';
import { CACHE_CONTROL, errorResponse, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const teams = parseTeamList(url.searchParams.get('teams'));
	if (teams.length === 0) return jsonResponse({ teams: [] }, CACHE_CONTROL.list);
	try {
		return jsonResponse({ teams: await loadFollowed(teams) }, CACHE_CONTROL.short);
	} catch (error) {
		return errorResponse(error, 'Team data is unavailable right now');
	}
};
