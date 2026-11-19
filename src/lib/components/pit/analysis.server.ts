import { analyzeEvent } from '#lib/analysis/analyze.ts';
import type { EventAnalysis } from '#lib/analysis/types.ts';
import { loadEventAnalysis, priorsForTeams } from '#lib/server/analysis.ts';
import type { EventBundle } from '#lib/types.ts';

export interface AnalysisOptions {
	replayAt?: number | null;
}

function eventStart(bundle: EventBundle): number {
	const times = bundle.matches
		.map((match) => match.scheduledTime ?? match.actualTime)
		.filter((time): time is number => time !== null);
	return times.length > 0 ? Math.min(...times) : Date.parse(bundle.event.start);
}

export async function getAnalysis(
	bundle: EventBundle,
	options: AnalysisOptions = {}
): Promise<EventAnalysis | null> {
	try {
		if (options.replayAt == null) return await loadEventAnalysis(bundle.event.code);
		const teams = bundle.teams.map((team) => team.number);
		const context = await priorsForTeams(teams, eventStart(bundle));
		return analyzeEvent(bundle, context, { now: options.replayAt });
	} catch {
		return null;
	}
}
