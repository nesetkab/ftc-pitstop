import { breakdownParts } from '#lib/game/biobuzz.ts';
import type { Match } from '#lib/types.ts';

export type PointAverages = {
	auto: number;
	hive: number;
	flower: number;
	garden: number;
	park: number;
	scores: number;
	matches: number;
};

export function pointAverages(matches: Match[]): PointAverages | null {
	const totals = { auto: 0, hive: 0, flower: 0, garden: 0, park: 0 };
	let scores = 0;
	let played = 0;
	for (const match of matches) {
		const result = match.result;
		if (!result?.red.breakdown || !result.blue.breakdown) continue;
		played += 1;
		for (const score of [result.red, result.blue]) {
			const parts = breakdownParts(score);
			totals.auto += parts.auto;
			totals.hive += parts.hive;
			totals.flower += parts.flower;
			totals.garden += parts.garden;
			totals.park += parts.park;
			scores += 1;
		}
	}
	if (scores === 0) return null;
	return {
		auto: totals.auto / scores,
		hive: totals.hive / scores,
		flower: totals.flower / scores,
		garden: totals.garden / scores,
		park: totals.park / scores,
		scores,
		matches: played
	};
}
