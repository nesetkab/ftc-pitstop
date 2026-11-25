import { oprShifts } from '#lib/components/event/standings.ts';
import { loadEventAnalysisEntry } from '#lib/server/analysis.ts';
import { loadBreakdowns } from '../../breakdowns.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const [{ breakdowns }, entry] = await Promise.all([
		loadBreakdowns(event),
		loadEventAnalysisEntry(event.params.code).catch(() => null)
	]);
	const key = event.params.key.toLowerCase();
	return { breakdowns, oprShifts: entry ? oprShifts(entry.analysis.ratings, key) : null };
};
