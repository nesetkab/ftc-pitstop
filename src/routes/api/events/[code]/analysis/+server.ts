import { loadEventAnalysisEntry } from '#lib/server/analysis.ts';
import { errorResponse, jsonResponse } from '#lib/server/http.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { analysis, cacheControl } = await loadEventAnalysisEntry(params.code);
		return jsonResponse(analysis, cacheControl);
	} catch (error) {
		return errorResponse(error, 'Event analysis is unavailable right now');
	}
};
