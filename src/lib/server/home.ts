import type { SeasonModel } from '#lib/analysis/season.ts';
import type { SeasonRating, SeasonRatings } from '#lib/analysis/types.ts';
import { followedTeam, type FollowedTeam } from '#lib/components/home/followed.ts';
import { buildHighlights, type Highlights } from '#lib/components/home/highlights.ts';
import { eventProgress, seasonProgress, type EventProgress } from '#lib/components/home/today.ts';
import { localDay } from '#lib/components/team/dates.ts';
import { SEASON } from '#lib/game/biobuzz.ts';
import { redChance } from '#lib/model/predict.ts';
import type { Forecast } from '#lib/model/opr.ts';
import { cache as defaultCache, type Cache } from '#lib/server/cache.ts';
import { loadSeasonModelWithin, loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { eventWindow, loadTeamSeason } from '#lib/server/event.ts';
import {
	ftcPaths,
	mapMatches,
	mapRankings,
	type FtcRankingsResponse,
	type FtcScheduleResponse
} from '#lib/server/ftc/index.ts';
import type { EventSummary, SeasonMatch, TeamSeason } from '#lib/types.ts';

const FRESH_MS = 120_000;
const MEMO_MS = 60_000;
const MAX_EVENTS = 60;
const SEASON_WAIT_MS = 800;

export interface HomeDeps {
	cache: Cache;
	loadTeamSeason: (number: number) => Promise<TeamSeason | null>;
	loadSeasonRatingsWithin: (ms?: number) => Promise<SeasonRatings | null>;
	loadSeasonModelWithin: (ms?: number) => Promise<SeasonModel | null>;
	now?: () => number;
}

function partKeys(code: string) {
	return {
		qual: `ftc:${SEASON}:${ftcPaths.schedule(code, 'qual')}`,
		playoff: `ftc:${SEASON}:${ftcPaths.schedule(code, 'playoff')}`,
		rankings: `ftc:${SEASON}:${ftcPaths.rankings(code)}`
	};
}

export function createHome(deps: HomeDeps) {
	const { cache } = deps;
	const now = deps.now ?? Date.now;
	let progressMemo: { key: string; at: number; value: Record<string, EventProgress> } | null = null;
	let highlightMemo: { key: string; value: Highlights | null } | null = null;
	let ratingIndex: { generatedAt: number; teams: Map<number, SeasonRating> } | null = null;

	async function loadTodayProgress(events: EventSummary[]): Promise<Record<string, EventProgress>> {
		const time = now();
		const chosen = events.slice(0, MAX_EVENTS);
		const memoKey = chosen.map((event) => event.code).join(',');
		if (progressMemo?.key === memoKey && time - progressMemo.at < MEMO_MS) {
			return progressMemo.value;
		}
		const keys = chosen.flatMap((event) => Object.values(partKeys(event.code)));
		const [found, model] = await Promise.all([
			cache.lookup(keys, FRESH_MS),
			deps.loadSeasonModelWithin(SEASON_WAIT_MS).catch(() => null)
		]);
		const played = new Map<string, SeasonMatch[]>(chosen.map((event) => [event.code, []]));
		for (const match of model?.matches ?? []) played.get(match.eventCode)?.push(match);
		const value: Record<string, EventProgress> = {};
		for (const event of chosen) {
			const parts = partKeys(event.code);
			const qual = found.get(parts.qual)?.body as FtcScheduleResponse | null | undefined;
			const playoff = found.get(parts.playoff)?.body as FtcScheduleResponse | null | undefined;
			const rankings = found.get(parts.rankings)?.body as FtcRankingsResponse | null | undefined;
			const fallback = seasonProgress(played.get(event.code) ?? []);
			if (!qual && !rankings) {
				if (fallback) value[event.code] = fallback;
				continue;
			}
			const progress = eventProgress({
				event,
				matches: mapMatches({
					timezone: event.timezone,
					qualSchedule: qual ?? null,
					playoffSchedule: playoff ?? null
				}),
				rankings: rankings?.rankings ? mapRankings(rankings) : [],
				now: time,
				endsAt: eventWindow(event).endsAt
			});
			const best = progress ?? fallback;
			if (best) value[event.code] = best;
		}
		progressMemo = { key: memoKey, at: time, value };
		return value;
	}

	function chanceFrom(model: SeasonModel) {
		const forecasts = new Map<string, Map<string, Forecast>>();
		return (code: string, key: string): number | null => {
			let steps = forecasts.get(code);
			if (!steps) {
				const event = model.run.events.get(code);
				steps = new Map((event?.steps ?? []).map((step) => [step.key, step.forecast]));
				forecasts.set(code, steps);
			}
			const forecast = steps.get(key);
			return forecast ? redChance(forecast) : null;
		};
	}

	async function loadHighlights(ms: number): Promise<Highlights | null> {
		const model = await deps.loadSeasonModelWithin(ms);
		if (!model) return null;
		const today = localDay(now(), 'UTC');
		const memoKey = `${model.generatedAt}:${today}`;
		if (highlightMemo?.key === memoKey) return highlightMemo.value;
		const chance = chanceFrom(model);
		const value = buildHighlights(model.matches, today, (match, winner) => {
			const red = chance(match.eventCode, match.key);
			if (red === null) return null;
			return winner === 'red' ? red : 1 - red;
		});
		highlightMemo = { key: memoKey, value };
		return value;
	}

	function ratingsFor(ratings: SeasonRatings | null) {
		if (!ratings) return null;
		if (ratingIndex?.generatedAt !== ratings.generatedAt) {
			ratingIndex = {
				generatedAt: ratings.generatedAt,
				teams: new Map(ratings.teams.map((rating) => [rating.team, rating]))
			};
		}
		return ratingIndex.teams;
	}

	async function loadFollowed(numbers: number[]): Promise<FollowedTeam[]> {
		const [seasons, ratings] = await Promise.all([
			Promise.all(numbers.map((number) => deps.loadTeamSeason(number).catch(() => null))),
			deps.loadSeasonRatingsWithin(800).catch(() => null)
		]);
		const index = ratingsFor(ratings);
		const time = now();
		return numbers.map((number, i) =>
			followedTeam(
				number,
				seasons[i],
				{ rating: index?.get(number) ?? null, rated: index?.size ?? 0 },
				time
			)
		);
	}

	return { loadTodayProgress, loadHighlights, loadFollowed };
}

export type Home = ReturnType<typeof createHome>;

export const home = createHome({
	cache: defaultCache,
	loadTeamSeason,
	loadSeasonRatingsWithin,
	loadSeasonModelWithin
});

export const { loadTodayProgress, loadHighlights, loadFollowed } = home;
