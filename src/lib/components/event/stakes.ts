import type { EventAnalysis, MatchForecast, TeamRating } from '#lib/analysis/types.ts';
import { allianceCountFor } from '#lib/model/bracket.ts';
import { simulateRankings, type SimMatch, type Tally } from '#lib/model/simulate.ts';
import type { AllianceColor, Match, Ranking } from '#lib/types.ts';

export type Stake = {
	team: number;
	color: AllianceColor;
	now: number;
	win: number;
	loss: number;
};

export type Stakes = { spots: number; teams: Stake[] };

type StakeInput = {
	match: Match;
	matches: Match[];
	rankings: Ranking[];
	analysis: Pick<EventAnalysis, 'forecasts' | 'ratings' | 'projections'>;
};

const COLORS: AllianceColor[] = ['red', 'blue'];

function simMatch(
	match: Match,
	forecast: MatchForecast,
	parts: Map<number, TeamRating['parts']>
): SimMatch {
	const sum = (color: AllianceColor, key: 'tips' | 'auto') =>
		match[color].reduce((total, entry) => total + (parts.get(entry.team)?.[key] ?? 0), 0);
	const { red, blue } = forecast;
	return {
		red: match.red.map((entry) => entry.team),
		blue: match.blue.map((entry) => entry.team),
		surrogates: [...match.red, ...match.blue]
			.filter((entry) => entry.surrogate)
			.map((entry) => entry.team),
		redWin: red.win,
		blueWin: blue.win,
		tie: forecast.tie,
		redScore: red.score,
		blueScore: blue.score,
		redSd: red.sd,
		blueSd: blue.sd,
		redTips: sum('red', 'tips'),
		blueTips: sum('blue', 'tips'),
		redPollinator1: red.rp.pollinator1,
		redPollinator2: red.rp.pollinator2,
		bluePollinator1: blue.rp.pollinator1,
		bluePollinator2: blue.rp.pollinator2,
		redSwarm: red.rp.swarm,
		blueSwarm: blue.rp.swarm,
		redAuto: sum('red', 'auto'),
		blueAuto: sum('blue', 'auto')
	};
}

function tally(row: Ranking): Tally {
	return {
		team: row.team,
		rp: row.rs * row.played,
		np: row.tbp * row.played,
		tips: row.avgTips * row.played,
		auto: row.avgAuto * row.played,
		counted: row.played
	};
}

export function matchStakes(input: StakeInput, sims = 2000): Stakes | null {
	const { match, matches, rankings, analysis } = input;
	if (match.level !== 'qual' || match.result || !analysis.projections) return null;
	const quals = matches.filter((entry) => entry.level === 'qual');
	const remaining = quals.filter((entry) => !entry.result);
	if (remaining.some((entry) => !analysis.forecasts[entry.key])) return null;
	const field = [...new Set(quals.flatMap((entry) => [...entry.red, ...entry.blue]))]
		.map((entry) => entry.team)
		.sort((a, b) => a - b);
	const spots = allianceCountFor(rankings.length || field.length);
	if (spots === 0) return null;
	const parts = new Map(analysis.ratings.map((rating) => [rating.team, rating.parts]));
	const current = rankings.map(tally);
	const plan = remaining.map((entry) => simMatch(entry, analysis.forecasts[entry.key], parts));
	const run = (winner?: AllianceColor) => {
		const forced = plan.map((entry, index) =>
			remaining[index].key === match.key ? { ...entry, winner } : entry
		);
		const projections = simulateRankings(
			{ teams: field, current, remaining: forced },
			{ sims, seed: 7 }
		);
		return new Map(
			projections.map((projection) => [
				projection.team,
				projection.rankChances.slice(0, spots).reduce((total, p) => total + p, 0)
			])
		);
	};
	const now = run();
	const outcomes = { red: run('red'), blue: run('blue') };
	const teams = COLORS.flatMap((color) =>
		match[color]
			.filter((entry) => !entry.surrogate)
			.map((entry) => {
				const other = color === 'red' ? 'blue' : 'red';
				return {
					team: entry.team,
					color,
					now: now.get(entry.team) ?? 0,
					win: outcomes[color].get(entry.team) ?? 0,
					loss: outcomes[other].get(entry.team) ?? 0
				};
			})
	);
	return { spots, teams };
}
