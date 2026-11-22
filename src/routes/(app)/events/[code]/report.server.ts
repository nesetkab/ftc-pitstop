import type { EventAnalysis } from '#lib/analysis/types.ts';
import { createReporter } from '#lib/components/event/report.ts';
import { loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { loadEventBundle } from '#lib/server/event.ts';
import { CACHE_CONTROL, shortestCache } from '#lib/server/http.ts';
import type { EventBundle } from '#lib/types.ts';

interface ReportEvent {
	params: { code: string };
	parent: () => Promise<{
		bundle: EventBundle;
		analysis: EventAnalysis | null;
		cacheControl: string;
	}>;
	setHeaders: (headers: Record<string, string>) => void;
}

export async function loadReporter({ params, parent, setHeaders }: ReportEvent) {
	const [{ bundle, analysis, cacheControl }, full, ratings] = await Promise.all([
		parent(),
		loadEventBundle(params.code).catch(() => null),
		loadSeasonRatingsWithin().catch(() => null)
	]);
	const rated = ratings !== null && ratings.teams.length > 0;
	setHeaders({
		'cache-control': shortestCache(cacheControl, rated ? CACHE_CONTROL.ratings : CACHE_CONTROL.live)
	});
	const source = full ?? bundle;
	const teams = new Set(source.teams.map((team) => team.number));
	for (const match of source.matches)
		for (const entry of [...match.red, ...match.blue]) teams.add(entry.team);
	return {
		bundle: source,
		report: createReporter({
			bundle: source,
			analysis,
			season: rated ? ratings.teams.filter((rating) => teams.has(rating.team)) : null,
			seasonCount: rated ? ratings.teams.length : null
		})
	};
}
