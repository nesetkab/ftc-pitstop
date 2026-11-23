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
import type { Rating } from '#lib/model/opr.ts';
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
}

export function fitParts(rating: Pick<Rating, 'components'>): FitParts {
	const { auto, teleop, hive, flower, garden, park, leave, tips } = rating.components;
	return { auto, teleop, hive, flower, garden, park, leavePark: leave + park, tips };
}

export function fitFromModel(model: SeasonModel, numbers: number[], average: FitParts): Fit | null {
	const teams: FitTeam[] = numbers.flatMap((number) => {
		const rating = model.run.latest.get(number);
		return rating ? [{ number, opr: rating.opr, parts: fitParts(rating) }] : [];
	});
	return buildFit({
		numbers,
		teams,
		average,
		robotSwarm: (pair) => model.run.swarm.chance(pair)
	});
}

export function createCompare(deps: CompareDeps) {
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
				? fitFromModel(model, present, averageOf(model))
				: null;
		const view = buildComparison({
			seasons,
			ratings,
			matches: model ? matchesInvolving(model.matches, present) : null,
			fit
		});
		const suggestions = present.length < MIN_FIT ? suggestNeighbors(ratings, present) : [];
		const names =
			suggestions.length > 0 ? (await deps.recordNames(suggestions, [])).teams : undefined;
		return {
			view,
			numbers: present,
			missing,
			suggestions: suggestions.map((number) => ({ number, name: names?.[number] ?? null })),
			cacheControl: !picking && !model ? CACHE_CONTROL.live : CACHE_CONTROL.short
		};
	};
}
