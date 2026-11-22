import { seasonEvents } from '#lib/analysis/convert.ts';
import defaults from '#lib/analysis/defaults.json';
import type {
	AnalysisContext,
	RatingPoint,
	SeasonEventRating,
	SeasonEventRatings,
	SeasonRating,
	SeasonRatings,
	TeamEventRating,
	TeamRatingHistory
} from '#lib/analysis/types.ts';
import {
	addSums,
	dayNumber,
	emptySums,
	matchSums,
	orderEvents,
	orderMatches,
	rateSeason,
	type SeasonRatings as SeasonRun,
	type Sums,
	type TeamState
} from '#lib/model/opr.ts';
import { SwarmBook } from '#lib/model/rp.ts';
import { rated, type ModelEvent } from '#lib/model/types.ts';
import type { SeasonMatch } from '#lib/types.ts';

export type SeasonModel = {
	generatedAt: number;
	complete: boolean;
	matches: SeasonMatch[];
	events: ModelEvent[];
	days: number[];
	sums: Sums[];
	run: SeasonRun;
	states: Map<number, { day: number; state: TeamState }[]>;
	ratings: SeasonRatings;
};

const points = (value: number) => Math.round(value * 100) / 100 || 0;

export function buildSeason(
	matches: SeasonMatch[],
	options: { previous: Map<number, number>; now: number; complete?: boolean }
): SeasonModel {
	const events = orderEvents(seasonEvents(matches));
	const run = rateSeason(events, { previous: options.previous });
	const regionOf = new Map(matches.map((m) => [m.eventCode, m.region]));
	const states = new Map<number, { day: number; state: TeamState }[]>();
	const totals = new Map<
		number,
		{ matches: number; events: number; regions: Map<string, number>; region: string | null }
	>();
	const days = events.map((event) => dayNumber(event.start));
	events.forEach((event, i) => {
		const rater = run.events.get(event.code)!.rater;
		const region = regionOf.get(event.code) ?? null;
		for (const [team, state] of rater.carry()) {
			const list = states.get(team) ?? [];
			list.push({ day: days[i], state });
			states.set(team, list);
			const played = rater.matchesPlayed(team);
			const total = totals.get(team) ?? {
				matches: 0,
				events: 0,
				regions: new Map<string, number>(),
				region: null
			};
			total.matches += played;
			total.events += 1;
			if (region) {
				const count = (total.regions.get(region) ?? 0) + played;
				total.regions.set(region, count);
				if (total.region === null || count >= (total.regions.get(total.region) ?? 0))
					total.region = region;
			}
			totals.set(team, total);
		}
	});
	const latest = [...run.latest.values()].sort((a, b) => b.opr - a.opr || a.team - b.team);
	const n = latest.length;
	const teams: SeasonRating[] = latest.map((r, i) => {
		const total = totals.get(r.team);
		return {
			team: r.team,
			opr: points(r.opr),
			parts: {
				auto: points(r.components.auto),
				hive: points(r.components.hive),
				flower: points(r.components.flower),
				garden: points(r.components.garden),
				park: points(r.components.park),
				tips: points(r.components.tips)
			},
			matches: total?.matches ?? r.matches,
			events: total?.events ?? 1,
			rank: i + 1,
			percentile: n > 1 ? Math.round(((n - 1 - i) / (n - 1)) * 10_000) / 10_000 : 1,
			region: total?.region ?? null
		};
	});
	return {
		generatedAt: options.now,
		complete: options.complete ?? true,
		matches,
		events,
		days,
		sums: events.map((event) => matchSums(event.matches)),
		run,
		states,
		ratings: { generatedAt: options.now, teams }
	};
}

function pickPrevious(teams: number[], previous: Map<number, number>): Record<number, number> {
	const out: Record<number, number> = {};
	for (const team of teams) {
		const rel = previous.get(team);
		if (rel !== undefined) out[team] = rel;
	}
	return out;
}

export function baseContext(teams: number[], previous: Map<number, number>): AnalysisContext {
	return {
		teams,
		states: {},
		previous: pickPrevious(teams, previous),
		sums: { ...defaults.sums, parts: [...defaults.sums.parts] },
		swarm: { totals: [...defaults.swarm], teams: {} }
	};
}

export function contextFor(
	model: SeasonModel | null,
	teams: number[],
	day: number,
	previous: Map<number, number>
): AnalysisContext {
	if (!model) return baseContext(teams, previous);
	const states: Record<number, TeamState> = {};
	const fresh: number[] = [];
	for (const team of teams) {
		let state: TeamState | undefined;
		for (const entry of model.states.get(team) ?? []) if (entry.day < day) state = entry.state;
		if (state) states[team] = state;
		else fresh.push(team);
	}
	const sums = emptySums();
	const book = new SwarmBook();
	model.events.forEach((event, i) => {
		if (model.days[i] >= day) return;
		addSums(sums, model.sums[i]);
		const ordered = orderMatches(event.matches);
		book.enterEvent(event.code, [...new Set(ordered.flatMap((m) => [...m.red, ...m.blue]))]);
		for (const m of ordered) if (rated(m)) book.update(m);
	});
	return {
		teams,
		states,
		previous: pickPrevious(fresh, previous),
		sums,
		swarm: book.snapshot(teams)
	};
}

export function teamHistory(model: SeasonModel, team: number): TeamRatingHistory | null {
	const events: TeamEventRating[] = [];
	const trail: RatingPoint[] = [];
	for (const event of model.events) {
		const rated = model.run.events.get(event.code)!;
		if (rated.rater.matchesPlayed(team) === 0) continue;
		const absent = new Set(
			event.matches.filter((m) => m.noShows?.includes(team)).map((m) => m.key)
		);
		let prior: number | null = null;
		for (const step of rated.steps) {
			const r = step.ratings.find((x) => x.team === team);
			if (!r || absent.has(step.key)) continue;
			prior ??= r.before;
			trail.push({ event: event.code, key: step.key, time: step.time, opr: points(r.after) });
		}
		events.push({
			code: event.code,
			start: event.start,
			prior: points(prior ?? rated.rater.value(team)),
			opr: points(rated.rater.value(team)),
			matches: rated.rater.matchesPlayed(team)
		});
	}
	if (events.length === 0) return null;
	return { team, generatedAt: model.generatedAt, events, points: trail };
}

export function eventRatings(model: SeasonModel): SeasonEventRatings {
	const types = new Map(model.matches.map((m) => [m.eventCode, m.eventType]));
	const events: SeasonEventRating[] = model.events.map((event) => {
		const { rater } = model.run.events.get(event.code)!;
		const teams = rater.teams
			.filter((team) => rater.matchesPlayed(team) > 0)
			.sort((a, b) => a - b)
			.flatMap((team) => [
				team,
				points(rater.value(team)),
				points(rater.value(team, 'auto')),
				points(rater.value(team, 'tips')),
				rater.matchesPlayed(team)
			]);
		return { code: event.code, type: types.get(event.code) ?? 'Other', start: event.start, teams };
	});
	return { generatedAt: model.generatedAt, events };
}
