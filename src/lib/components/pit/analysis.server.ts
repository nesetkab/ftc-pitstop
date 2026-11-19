import type { EventAnalysis } from '#lib/analysis/types.ts';
import { loadEventAnalysis } from '#lib/server/analysis.ts';
import type { EventBundle } from '#lib/types.ts';

export interface AnalysisOptions {
	replayAt?: number | null;
}

export async function getAnalysis(
	bundle: EventBundle,
	options: AnalysisOptions = {}
): Promise<EventAnalysis | null> {
	if (options.replayAt != null) return null;
	try {
		return await loadEventAnalysis(bundle.event.code);
	} catch {
		return null;
	}
}
