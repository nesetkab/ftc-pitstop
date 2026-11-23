import type {
	EventAnalysis,
	MatchForecast,
	Projection,
	ScheduleStrength,
	TeamRating
} from '#lib/analysis/types.ts';
import { fixtureBundle as liveBundle } from '#lib/components/pit/fixtures.ts';
import type { EventBundle, Match } from '#lib/types.ts';

export function fixtureBundle(code: string): EventBundle {
	return { ...liveBundle(code), advancement: null, phase: 'done' };
}

export function unplay(bundle: EventBundle, from: (match: Match) => boolean): EventBundle {
	return {
		...bundle,
		matches: bundle.matches.map((match) => (from(match) ? { ...match, result: null } : match))
	};
}

function forecast(match: Match, index: number): MatchForecast {
	const red = 50 + (index % 7);
	const blue = 48 + (index % 5);
	const win = red > blue ? 0.6 : red < blue ? 0.4 : 0.5;
	const rp = (chance: number) => ({
		win: chance,
		tie: 0.01,
		swarm: 0.25,
		pollinator1: 0.12,
		pollinator2: 0.004,
		expected: 1.5 + chance
	});
	return {
		key: match.key,
		red: { score: red, sd: 12, win, rp: rp(win) },
		blue: { score: blue, sd: 12, win: 1 - win, rp: rp(1 - win) },
		tie: 0.01,
		played: match.result !== null,
		correct: null
	};
}

export function fakeAnalysis(bundle: EventBundle): EventAnalysis {
	const ratings: TeamRating[] = bundle.rankings.map((row, index) => ({
		team: row.team,
		opr: 60 - index,
		parts: { auto: 12, hive: 30, flower: 0, garden: 1.5, park: 7, tips: 1.25 },
		matches: row.played,
		rank: index + 1,
		prior: 30,
		history: []
	}));
	const size = bundle.rankings.length;
	const projections: Projection[] = bundle.rankings.map((row, index) => {
		const rankChances = Array.from({ length: size }, (_, place) =>
			place === index ? 0.6 : 0.4 / (size - 1)
		);
		return {
			team: row.team,
			rankChances,
			top4: index < 4 ? 0.9 : 0.05,
			top8: index < 8 ? 0.95 : 0.1,
			expectedRs: row.rs,
			expectedRank: index + 1
		};
	});
	const strength: ScheduleStrength[] = bundle.rankings.map((row, index) => ({
		team: row.team,
		partners: 30 + (index % 3),
		opponents: 28 + (index % 4),
		ratingRank: size - index,
		expectedRs: row.rs,
		actualRs: row.rs
	}));
	return {
		code: bundle.event.code,
		generatedAt: bundle.fetchedAt,
		model: { id: 'opr-prior', label: 'OPR' },
		ratings,
		forecasts: Object.fromEntries(
			bundle.matches.map((match, index) => [match.key, forecast(match, index)])
		),
		timing: {
			cycleSeconds: 390,
			delaySeconds: 180,
			onField: null,
			next: null,
			matches: Object.fromEntries(
				bundle.matches.map((match) => [
					match.key,
					{
						key: match.key,
						scheduled: match.scheduledTime,
						expectedStart: match.scheduledTime === null ? null : match.scheduledTime + 180_000,
						queueAt: null,
						matchesAway: null
					}
				])
			)
		},
		projections,
		strength,
		playoffs: bundle.alliances.map((alliance, index) => ({
			seed: alliance.seed,
			teams: [alliance.captain, ...alliance.picks],
			strength: 100 - index,
			winEvent: index === 0 ? 0.55 : 0.45 / Math.max(1, bundle.alliances.length - 1),
			reachFinal: 0.5,
			winNext: 0.5
		})),
		picks: null,
		averages: {
			parts: { auto: 18, hive: 40, flower: 0, garden: 1.5, park: 7.3, tips: 1.2 },
			score: 70,
			matches: 22
		}
	};
}
