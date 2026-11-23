import { describe, expect, it } from 'vitest';
import { analyzeEvent } from '#lib/analysis/analyze.ts';
import { buildSeason, contextFor } from '#lib/analysis/season.ts';
import { dayNumber, previousFrom } from '#lib/model/opr.ts';
import { teamSeason } from '#lib/components/team/fixtures.ts';
import { calibratedTips } from '#lib/model/rp.ts';
import { createCompare } from '#lib/server/compare.ts';
import { createSimulate, simulateMatch, topFour } from '#lib/server/simulate.ts';
import { bundleFor, cutAfterQual, seasonMatchesOf } from './helpers.ts';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const bundle = await bundleFor('USAZGIQ');
const season = seasonMatchesOf(bundle, 'USAZXXQ', '2026-11-07');
const previous = previousFrom({});
const model = buildSeason(season, { previous, now: NOW });
const START = '2026-11-21';
const DAY = dayNumber(START);

const later = cutAfterQual(
	{ ...bundle, event: { ...bundle.event, code: 'USAZSIMQ', start: START, end: START } },
	0
);
const first = later.matches.find((match) => match.level === 'qual' && match.number === 1)!;
const red = first.red.map((entry) => entry.team);
const blue = first.blue.map((entry) => entry.team);

describe('simulateMatch', () => {
	const simulation = simulateMatch(model, { red, blue }, { previous, day: DAY, names: {} });

	it('matches the prediction a new event would make for the same teams', () => {
		const teams = [...new Set(later.matches.flatMap((m) => [...m.red, ...m.blue]))].map(
			(entry) => entry.team
		);
		const analysis = analyzeEvent(later, contextFor(model, teams, DAY, previous), { now: NOW });
		const expected = analysis.forecasts[first.key];
		for (const color of ['red', 'blue'] as const) {
			expect(simulation.forecast[color].win).toBeCloseTo(expected[color].win, 3);
			expect(simulation.forecast[color].score).toBeCloseTo(expected[color].score, 1);
			expect(simulation.forecast[color].sd).toBeCloseTo(expected[color].sd, 1);
			expect(simulation.forecast[color].rp.swarm).toBeCloseTo(expected[color].rp.swarm, 3);
			expect(simulation.forecast[color].rp.pollinator1).toBeCloseTo(
				expected[color].rp.pollinator1,
				3
			);
		}
		expect(simulation.forecast.tie).toBeCloseTo(expected.tie, 3);
	});

	it('adds up each team into its alliance and keeps the chances whole', () => {
		const { forecast } = simulation;
		expect(forecast.red.win + forecast.blue.win + forecast.tie).toBeCloseTo(1, 3);
		for (const color of ['red', 'blue'] as const) {
			const side = simulation[color];
			expect(side.teams.map((team) => team.number)).toEqual(color === 'red' ? red : blue);
			const sum = side.teams.reduce((total, team) => total + team.opr, 0);
			expect(side.np).toBeCloseTo(sum, 6);
			expect(side.parts.tips).toBeCloseTo(
				side.teams.reduce((total, team) => total + team.parts.tips, 0),
				6
			);
			expect(side.score).toBeCloseTo(side.np + side.fouls, 6);
			expect(side.low).toBeLessThan(side.score);
			expect(side.high).toBeGreaterThan(side.score);
			expect(forecast[color].rp.pollinator1).toBeCloseTo(
				calibratedTips(side.parts.tips).pollinator1,
				3
			);
		}
		expect(simulation.notes.length).toBeGreaterThanOrEqual(2);
		expect(simulation.notes.length).toBeLessThanOrEqual(3);
	});

	it('mirrors when the sides swap', () => {
		const flipped = simulateMatch(
			model,
			{ red: blue, blue: red },
			{ previous, day: DAY, names: {} }
		);
		expect(flipped.forecast.red.win).toBeCloseTo(simulation.forecast.blue.win, 6);
		expect(flipped.red.score).toBeCloseTo(simulation.blue.score, 6);
	});

	it('marks teams with no matches this season and still predicts them', () => {
		const result = simulateMatch(
			model,
			{ red: [red[0], 99_999], blue },
			{ previous, day: DAY, names: { 99_999: 'Rookies' } }
		);
		const rookie = result.red.teams[1];
		expect(rookie).toMatchObject({ number: 99_999, name: 'Rookies', rated: false });
		expect(rookie.opr).toBeGreaterThan(0);
		expect(result.red.teams[0].rated).toBe(true);
	});

	it('suggests the top four teams split one and four against two and three', () => {
		const ranked = model.ratings.teams.slice(0, 4).map((entry) => entry.team);
		expect(topFour(model)).toEqual({
			red: [ranked[0], ranked[3]],
			blue: [ranked[1], ranked[2]]
		});
	});
});

describe('createSimulate', () => {
	const names = Object.fromEntries([...red, ...blue].map((team) => [team, `Team ${team}`]));
	const load = (loaded: typeof model | null) =>
		createSimulate({
			loadSeasonModelWithin: async () => loaded,
			recordNames: async (teams) => ({
				teams: Object.fromEntries(
					teams.flatMap((team) => (names[team] ? [[team, names[team]]] : []))
				),
				events: {}
			}),
			previous,
			now: () => Date.parse(`${START}T12:00:00Z`)
		});

	it('predicts a full match and caches it for a few minutes', async () => {
		const result = await load(model)({ red, blue });
		expect(result.simulation?.red.teams[0].name).toBe(`Team ${red[0]}`);
		expect(result.picked.blue).toEqual(blue.map((number) => ({ number, name: `Team ${number}` })));
		expect(result.cacheControl).toBe('public, s-maxage=300, stale-while-revalidate=3600');
	});

	it('drops numbers that are not teams and waits for four', async () => {
		const result = await load(model)({ red: [red[0], 424_242], blue });
		expect(result.missing).toEqual([424_242]);
		expect(result.sides.red).toEqual([red[0]]);
		expect(result.simulation).toBeNull();
	});

	it('keeps the picks but no prediction while ratings load', async () => {
		const result = await load(null)({ red, blue });
		expect(result.simulation).toBeNull();
		expect(result.ready).toBe(false);
		expect(result.cacheControl).toBe('public, s-maxage=30, stale-while-revalidate=300');
	});

	it('offers the top four when nothing is picked', async () => {
		const result = await load(model)({ red: [], blue: [] });
		expect(result.suggestion?.sides).toEqual(topFour(model));
	});
});

describe('compare and simulate agree', () => {
	const now = () => Date.parse(`${START}T12:00:00Z`);
	const compare = createCompare({
		loadTeamSeason: async (number) => teamSeason(number, `Team ${number}`),
		loadSeasonRatingsWithin: async () => model.ratings,
		loadSeasonModelWithin: async () => model,
		recordNames: async () => ({ teams: {}, events: {} }),
		previous,
		now
	});
	const simulate = createSimulate({
		loadSeasonModelWithin: async () => model,
		recordNames: async () => ({ teams: {}, events: {} }),
		previous,
		now
	});
	const others = model.ratings.teams
		.map((entry) => entry.team)
		.filter((team) => ![...red, ...blue].includes(team))
		.slice(0, 2);

	it('predicts the same score, parts and ranking point chances for an alliance', async () => {
		for (const [pair, opponents] of [
			[red, blue],
			[red, others],
			[blue, red]
		]) {
			const fit = (await compare(pair)).view.fit!;
			const [predicted] = fit.alliances;
			const simulation = (await simulate({ red: pair, blue: opponents })).simulation!;
			expect(predicted.teams).toEqual(pair);
			expect(predicted.score).toBeCloseTo(simulation.red.np, 6);
			expect(predicted.parts.tips).toBeCloseTo(simulation.red.parts.tips, 6);
			expect(predicted.parts.leavePark).toBeCloseTo(simulation.red.parts.leavePark, 6);
			for (const key of ['swarm', 'pollinator1', 'pollinator2'] as const) {
				expect(predicted.chances[key]).toBeCloseTo(simulation.forecast.red.rp[key], 3);
			}
			for (const team of fit.teams) {
				const simulated = simulation.red.teams.find((entry) => entry.number === team.number)!;
				expect(team.opr).toBeCloseTo(simulated.opr, 6);
			}
		}
	});

	it('ranks every pair of three teams by the same model', async () => {
		const three = [red[0], red[1], blue[0]];
		const fit = (await compare(three)).view.fit!;
		expect(fit.alliances).toHaveLength(3);
		for (const pair of fit.alliances) {
			const rest = three.filter((team) => !pair.teams.includes(team));
			const simulation = (await simulate({ red: pair.teams, blue: [...rest, blue[1]] }))
				.simulation!;
			expect(pair.score).toBeCloseTo(simulation.red.np, 6);
			expect(pair.chances.swarm).toBeCloseTo(simulation.forecast.red.rp.swarm, 3);
		}
	});
});
