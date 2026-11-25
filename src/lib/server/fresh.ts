import type { SeasonModel } from '#lib/analysis/season.ts';
import type { FitChances, FitParts } from '#lib/components/compare/fit.ts';
import {
	COMPONENTS,
	EventRater,
	OPR_PARAMS,
	type Component,
	type PriorRel,
	type Priors,
	type Rating
} from '#lib/model/opr.ts';
import { predictMatch, type MatchPrediction } from '#lib/model/predict.ts';
import { SwarmBook } from '#lib/model/rp.ts';

export type FreshModel = Pick<SeasonModel, 'run'>;

export interface FreshOptions {
	previous: Map<number, PriorRel>;
	day: number;
}

export interface FreshTeam {
	opr: number;
	parts: FitParts;
}

export interface AllianceOutlook {
	score: number;
	sd: number;
	chances: FitChances;
}

export interface FreshEvent {
	team: (number: number) => FreshTeam;
	match: (red: number[], blue: number[]) => MatchPrediction;
	alliance: (teams: number[]) => AllianceOutlook;
}

const FRESH = 'simulate';

export function fitParts(rating: Pick<Rating, 'components'>): FitParts {
	const { auto, teleop, hive, flower, garden, park, leave, tips } = rating.components;
	return { auto, teleop, hive, flower, garden, park, leavePark: leave + park, tips };
}

export function freshEvent(model: FreshModel, teams: number[], options: FreshOptions): FreshEvent {
	const { run } = model;
	const priors: Priors = { params: OPR_PARAMS, states: run.states, previous: options.previous };
	const rater = new EventRater(FRESH, teams, priors, () => run.stats, options.day);
	const book = SwarmBook.from(run.swarm.snapshot(teams));
	book.enterEvent(FRESH, teams);

	const match = (red: number[], blue: number[]) =>
		predictMatch(rater.forecast(red, blue), {
			swarm: { red: book.chance(red), blue: book.chance(blue) }
		});

	return {
		team(number) {
			const components = Object.fromEntries(
				COMPONENTS.map((part) => [part, rater.value(number, part)])
			) as Record<Component, number>;
			return { opr: rater.value(number), parts: fitParts({ components }) };
		},
		match,
		alliance(members) {
			const { np, sd, rp } = match(members, []).red;
			return {
				score: np,
				sd,
				chances: { swarm: rp.swarm, pollinator1: rp.pollinator1, pollinator2: rp.pollinator2 }
			};
		}
	};
}
