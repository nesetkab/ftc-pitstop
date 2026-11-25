import type { SeasonModel } from '#lib/analysis/season.ts';
import type { SeasonRatings } from '#lib/analysis/types.ts';
import {
	buildComparison,
	matchesInvolving,
	suggestNeighbors
} from '#lib/components/compare/compare.ts';
import {
	averageParts,
	buildFit,
	MAX_FIT,
	MIN_FIT,
	type Fit,
	type FitParts,
	type FitTeam
} from '#lib/components/compare/fit.ts';
import { seasonTrend } from '#lib/components/compare/trend.ts';
import { dayNumber, previousFrom, type PriorRel } from '#lib/model/opr.ts';
import previousSeason from '#lib/model/previous-2025.json';
import { fitParts, freshEvent, type FreshModel, type FreshOptions } from '#lib/server/fresh.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { TeamSeason } from '#lib/types.ts';

export interface CompareDeps {
	loadTeamSeason: (number: number) => Promise<TeamSeason | null>;
	loadSeasonRatingsWithin: () => Promise<SeasonRatings | null>;
	loadSeasonModelWithin: () => Promise<SeasonModel | null>;
	recordNames: (
		teams: number[],
		events: string[]
	) => Promise<{ teams: Record<number, string>; events: Record<string, string> }>;
	previous?: Map<number, PriorRel>;
	now?: () => number;
}

export function fitFromModel(
	model: FreshModel,
	numbers: number[],
	average: FitParts,
	options: FreshOptions
): Fit | null {
	const rated = numbers.filter((number) => model.run.latest.has(number));
	const event = freshEvent(model, rated, options);
	const teams: FitTeam[] = rated.map((number) => ({ number, ...event.team(number) }));
	return buildFit({ numbers, teams, average, predict: event.alliance });
}

export function createCompare(deps: CompareDeps) {
	const previous = deps.previous ?? previousFrom(previousSeason);
	const now = deps.now ?? Date.now;
	let averages: { generatedAt: number; parts: FitParts } | null = null;

	function averageOf(model: SeasonModel): FitParts {
		if (averages?.generatedAt !== model.generatedAt) {
			const parts = averageParts([...model.run.latest.values()].map(fitParts));
			averages = { generatedAt: model.generatedAt, parts };
		}
		return averages.parts;
	}

	return async function loadComparison(numbers: number[]) {
		const picking = numbers.length < MIN_FIT;
		const [found, stored, model] = await Promise.all([
			Promise.all(numbers.map((number) => deps.loadTeamSeason(number).catch(() => null))),
			deps.loadSeasonRatingsWithin().catch(() => null),
			picking ? null : deps.loadSeasonModelWithin().catch(() => null),
			picking ? deps.recordNames([], []).catch(() => null) : null
		]);
		const seasons = found.filter((season): season is TeamSeason => season !== null);
		const missing = numbers.filter((_, index) => found[index] === null);
		const present = seasons.map((season) => season.team.number);
		const ratings = stored ?? model?.ratings ?? null;
		const fit =
			model && present.length >= MIN_FIT && present.length <= MAX_FIT
				? fitFromModel(model, present, averageOf(model), {
						previous,
						day: dayNumber(new Date(now()).toISOString())
					})
				: null;
		const view = buildComparison({
			seasons,
			ratings,
			matches: model ? matchesInvolving(model.matches, present) : null,
			fit
		});
		const trend = model && present.length >= MIN_FIT ? seasonTrend(model, seasons) : [];
		const suggestions = present.length < MIN_FIT ? suggestNeighbors(ratings, present) : [];
		const names =
			suggestions.length > 0 ? (await deps.recordNames(suggestions, [])).teams : undefined;
		return {
			view,
			numbers: present,
			missing,
			trend,
			suggestions: suggestions.map((number) => ({ number, name: names?.[number] ?? null })),
			cacheControl: !picking && !model ? CACHE_CONTROL.live : CACHE_CONTROL.short
		};
	};
}
