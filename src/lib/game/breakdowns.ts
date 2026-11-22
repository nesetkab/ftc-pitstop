import type { AllianceScore, Match, ScoreBreakdown } from '#lib/types.ts';

export type Breakdowns = Record<string, [ScoreBreakdown | null, ScoreBreakdown | null]>;

type WithMatches = { matches: Match[] };

function scoreWith(score: AllianceScore, breakdown: ScoreBreakdown | null): AllianceScore {
	return score.breakdown === breakdown ? score : { ...score, breakdown };
}

function matchWith(match: Match, red: ScoreBreakdown | null, blue: ScoreBreakdown | null): Match {
	if (!match.result) return match;
	return {
		...match,
		result: {
			...match.result,
			red: scoreWith(match.result.red, red),
			blue: scoreWith(match.result.blue, blue)
		}
	};
}

export function withoutBreakdowns<T extends WithMatches>(bundle: T): T {
	return { ...bundle, matches: bundle.matches.map((match) => matchWith(match, null, null)) };
}

export function breakdownsOf(matches: Match[]): Breakdowns {
	const breakdowns: Breakdowns = {};
	for (const match of matches) {
		if (match.result) {
			breakdowns[match.key] = [match.result.red.breakdown, match.result.blue.breakdown];
		}
	}
	return breakdowns;
}

export function withBreakdowns<T extends WithMatches>(bundle: T, breakdowns: Breakdowns): T {
	return {
		...bundle,
		matches: bundle.matches.map((match) => {
			const [red, blue] = breakdowns[match.key] ?? [null, null];
			return matchWith(match, red, blue);
		})
	};
}
