import type { EventAnalysis } from '#lib/analysis/types.ts';

export interface AnalysisRequest {
	code: string;
	at: number | null;
	version: string;
}

export type AnalysisLoader = (request: AnalysisRequest) => Promise<EventAnalysis | null>;

const remoteReplay: AnalysisLoader = async (request) => {
	const { pitAnalysis } = await import('./analysis.remote.ts');
	return pitAnalysis(request);
};

export function analysisLoader(
	replay: AnalysisLoader = remoteReplay,
	fetcher: typeof fetch = fetch
): AnalysisLoader {
	return async (request) => {
		if (request.at !== null) return replay(request);
		const version = encodeURIComponent(request.version);
		const response = await fetcher(`/api/events/${request.code}/analysis?v=${version}`);
		if (!response.ok) throw new Error(`Analysis returned ${response.status}`);
		return (await response.json()) as EventAnalysis;
	};
}
