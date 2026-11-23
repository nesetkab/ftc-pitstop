import { matchForecast } from '#lib/analysis/analyze.ts';
import type { SeasonModel } from '#lib/analysis/season.ts';
import { sumParts } from '#lib/components/compare/fit.ts';
import {
	COLORS,
	decisionNotes,
	isFull,
	scoreRange,
	type Color,
	type SimSide,
	type SimTeam,
	type Sides,
	type Simulation
} from '#lib/components/simulate/simulate.ts';
import { dayNumber, previousFrom } from '#lib/model/opr.ts';
import previousSeason from '#lib/model/previous-2025.json';
import { freshEvent, type FreshModel, type FreshOptions } from '#lib/server/fresh.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';

export type SimulationModel = FreshModel;

export interface SimulateOptions extends FreshOptions {
	names: Record<number, string>;
}

export interface PickedTeam {
	number: number;
	name: string | null;
}

export interface SimulateDeps {
	loadSeasonModelWithin: () => Promise<SeasonModel | null>;
	recordNames: (
		teams: number[],
		events: string[]
	) => Promise<{ teams: Record<number, string>; events: Record<string, string> }>;
	previous?: Map<number, number>;
	now?: () => number;
}

export function simulateMatch(
	model: SimulationModel,
	sides: Sides,
	options: SimulateOptions
): Simulation {
	const everyone = [...sides.red, ...sides.blue];
	const event = freshEvent(model, everyone, options);
	const prediction = event.match(sides.red, sides.blue);
	const team = (number: number): SimTeam => ({
		number,
		name: options.names[number] ?? null,
		rated: model.run.latest.has(number),
		...event.team(number)
	});
	const side = (color: Color): SimSide => {
		const predicted = prediction[color];
		const teams = sides[color].map(team);
		return {
			color,
			teams,
			score: predicted.score,
			np: predicted.np,
			fouls: predicted.score - predicted.np,
			...scoreRange(predicted.score, predicted.sd),
			parts: sumParts(teams.map((entry) => entry.parts))
		};
	};
	const red = side('red');
	const blue = side('blue');
	const summary = matchForecast('simulate', prediction, false, null);
	return {
		red,
		blue,
		forecast: summary,
		margin: prediction.margin,
		marginSd: prediction.marginSd,
		notes: decisionNotes(red, blue, summary, prediction.margin, prediction.marginSd)
	};
}

export function topFour(model: Pick<SeasonModel, 'ratings'>): Sides | null {
	const top = model.ratings.teams
		.toSorted((a, b) => a.rank - b.rank)
		.slice(0, 4)
		.map((entry) => entry.team);
	if (top.length < 4) return null;
	return { red: [top[0], top[3]], blue: [top[1], top[2]] };
}

export function createSimulate(deps: SimulateDeps) {
	const previous = deps.previous ?? previousFrom(previousSeason.teams);
	const now = deps.now ?? Date.now;

	return async function loadSimulation(sides: Sides) {
		const numbers = COLORS.flatMap((color) => sides[color]);
		const [model, found] = await Promise.all([
			deps.loadSeasonModelWithin().catch(() => null),
			numbers.length > 0 ? deps.recordNames(numbers, []).catch(() => null) : null
		]);
		const names = found?.teams ?? {};
		const listed = Object.keys(names).length > 0;
		const missing = listed
			? numbers.filter((number) => !names[number] && !model?.run.latest.has(number))
			: [];
		const known = (number: number) => !missing.includes(number);
		const kept: Sides = { red: sides.red.filter(known), blue: sides.blue.filter(known) };
		const picked = (color: Color): PickedTeam[] =>
			kept[color].map((number) => ({ number, name: names[number] ?? null }));
		const simulation =
			model && isFull(kept)
				? simulateMatch(model, kept, {
						previous,
						day: dayNumber(new Date(now()).toISOString()),
						names
					})
				: null;
		const suggestion = model && numbers.length === 0 ? topFour(model) : null;
		const suggested = suggestion
			? await deps
					.recordNames([...suggestion.red, ...suggestion.blue], [])
					.then((result) => result.teams)
					.catch(() => ({}) as Record<number, string>)
			: null;
		return {
			sides: kept,
			picked: { red: picked('red'), blue: picked('blue') },
			missing,
			simulation,
			suggestion: suggestion && suggested ? { sides: suggestion, names: suggested } : null,
			ready: model !== null,
			cacheControl: model ? CACHE_CONTROL.short : CACHE_CONTROL.live
		};
	};
}
