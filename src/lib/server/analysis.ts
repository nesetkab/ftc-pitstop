import { analyzeEvent } from '#lib/analysis/analyze.ts';
import { buildSeason, contextFor, teamHistory, type SeasonModel } from '#lib/analysis/season.ts';
import type {
	AnalysisContext,
	EventAnalysis,
	SeasonRatings,
	TeamRatingHistory
} from '#lib/analysis/types.ts';
import { SEASON } from '#lib/game/biobuzz.ts';
import { dayNumber, previousFrom } from '#lib/model/opr.ts';
import previousSeason from '#lib/model/previous-2025.json';
import { cache as sharedCache, type Cache, type CachePolicy } from '#lib/server/cache.ts';
import { DataError, describeError, unavailable } from '#lib/server/errors.ts';
import {
	eventTier,
	loaders as defaultLoaders,
	normalizeTeamNumber,
	type EventTier,
	type Loaders
} from '#lib/server/event.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { EventBundle, EventPhase } from '#lib/types.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY_SECONDS = 86_400;

export const RATINGS_POLICY: CachePolicy = { ttl: 3600, maxStale: DAY_SECONDS };

export function analysisPolicy(tier: EventTier, phase: EventPhase): CachePolicy {
	if (tier === 'finished') return { ttl: DAY_SECONDS, maxStale: 7 * DAY_SECONDS };
	if (tier === 'upcoming') return { ttl: 600, maxStale: DAY_SECONDS };
	if (phase === 'done') return { ttl: 300, maxStale: DAY_SECONDS };
	return { ttl: 30, maxStale: 300 };
}

type RequestStore = { get?: () => { waitUntil?: (task: Promise<unknown>) => void } | undefined };

const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');

function keepAlive(task: Promise<unknown>): void {
	const store = (globalThis as unknown as Record<symbol, RequestStore | undefined>)[
		REQUEST_CONTEXT
	];
	store?.get?.()?.waitUntil?.(task.catch(() => undefined));
}

class ColdStart extends Error {}

class Incomplete extends Error {
	readonly model: SeasonModel;

	constructor(model: SeasonModel) {
		super('Season data is incomplete');
		this.model = model;
	}
}

function within<T>(task: Promise<T>, ms: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new ColdStart()), Math.max(0, ms));
		task.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}

function teamsOf(bundle: EventBundle): number[] {
	const teams = new Set(bundle.teams.map((team) => team.number));
	for (const match of bundle.matches)
		for (const side of [match.red, match.blue]) for (const t of side) teams.add(t.team);
	for (const ranking of bundle.rankings) teams.add(ranking.team);
	for (const alliance of bundle.alliances)
		for (const team of [alliance.captain, ...alliance.picks, alliance.backup])
			if (team) teams.add(team);
	return [...teams].sort((a, b) => a - b);
}

export interface AnalysisDeps {
	loaders: Pick<Loaders, 'loadEventBundle' | 'loadSeasonMatches'>;
	cache: Cache;
	previous?: Map<number, number>;
	now?: () => number;
	budgetMs?: number;
	background?: (task: Promise<unknown>) => void;
}

export function createAnalysis(deps: AnalysisDeps) {
	const { loaders, cache } = deps;
	const now = deps.now ?? Date.now;
	const previous = deps.previous ?? previousFrom(previousSeason.teams);
	const budget = deps.budgetMs ?? 2500;
	const background = deps.background ?? keepAlive;
	let current: { model: SeasonModel; expires: number } | null = null;
	let pending: Promise<SeasonModel> | null = null;
	let pendingSince = 0;

	async function build(): Promise<SeasonModel> {
		const season = await loaders.loadSeasonMatches();
		if (season.matches.length === 0) throw unavailable('Season matches are unavailable right now');
		return buildSeason(season.matches, {
			previous,
			now: now(),
			complete: season.missing.length === 0
		});
	}

	function loadSeasonModel(): Promise<SeasonModel> {
		const time = now();
		if (current && time < current.expires) return Promise.resolve(current.model);
		if (!pending) {
			pendingSince = time;
			pending = build()
				.then((model) => {
					current = { model, expires: now() + (model.complete ? HOUR : 2 * MINUTE) };
					return model;
				})
				.finally(() => {
					pending = null;
				});
		}
		if (current && time < current.model.generatedAt + DAY_SECONDS * 1000) {
			pending.catch((error: unknown) =>
				console.warn(`season ratings refresh failed: ${describeError(error)}`)
			);
			return Promise.resolve(current.model);
		}
		return pending;
	}

	async function loadEventAnalysisEntry(
		input: string
	): Promise<{ analysis: EventAnalysis; cacheControl: string }> {
		const model = loadSeasonModel();
		model.catch(() => undefined);
		const deadline = pending ? Math.max(now(), pendingSince + budget) : now() + budget;
		const { cacheControl, ...bundle } = await loaders.loadEventBundle(input);
		const teams = teamsOf(bundle);
		const day = dayNumber(bundle.event.start);
		const policy = analysisPolicy(eventTier(bundle.event, now()), bundle.phase);
		try {
			const value = await cache.get<EventAnalysis>(
				`analysis:${SEASON}:event:v1:${bundle.event.code}`,
				policy,
				async () => {
					const season = await within(model, deadline - now()).catch(() => {
						throw new ColdStart();
					});
					const context = contextFor(season, teams, day, previous);
					return { status: 'ok', body: analyzeEvent(bundle, context, { now: now() }) };
				}
			);
			return { analysis: value.body, cacheControl };
		} catch (error) {
			if (!(error instanceof ColdStart)) throw error;
			background(model);
			const context = contextFor(null, teams, day, previous);
			return {
				analysis: analyzeEvent(bundle, context, { now: now() }),
				cacheControl: CACHE_CONTROL.live
			};
		}
	}

	async function loadEventAnalysis(code: string): Promise<EventAnalysis | null> {
		try {
			return (await loadEventAnalysisEntry(code)).analysis;
		} catch (error) {
			if (error instanceof DataError && error.status === 404) return null;
			throw error;
		}
	}

	async function loadSeasonRatings(): Promise<SeasonRatings | null> {
		try {
			const value = await cache.get<SeasonRatings>(
				`analysis:${SEASON}:ratings:v1`,
				RATINGS_POLICY,
				async () => {
					const model = await loadSeasonModel();
					if (!model.complete) throw new Incomplete(model);
					return { status: 'ok', body: model.ratings };
				}
			);
			return value.body;
		} catch (error) {
			if (error instanceof Incomplete) return error.model.ratings;
			return null;
		}
	}

	async function loadTeamRatingHistory(number: number | string): Promise<TeamRatingHistory | null> {
		const team = normalizeTeamNumber(number);
		return teamHistory(await loadSeasonModel(), team);
	}

	async function settleWithin<T>(task: Promise<T>, ms: number): Promise<T | null> {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<null>((resolve) => {
			timer = setTimeout(() => resolve(null), ms);
		});
		const result = await Promise.race([task.catch(() => null), timeout]);
		clearTimeout(timer);
		if (result === null) background(task);
		return result;
	}

	function loadSeasonRatingsWithin(ms: number = budget): Promise<SeasonRatings | null> {
		return settleWithin(loadSeasonRatings(), ms);
	}

	function loadTeamRatingHistoryWithin(
		number: number | string,
		ms: number = budget
	): Promise<TeamRatingHistory | null> {
		return settleWithin(loadTeamRatingHistory(number), ms);
	}

	async function priorsForTeams(numbers: number[], beforeTime: number): Promise<AnalysisContext> {
		const teams = [...new Set(numbers)].sort((a, b) => a - b);
		const model = await settleWithin(loadSeasonModel(), budget);
		return contextFor(model, teams, dayNumber(new Date(beforeTime).toISOString()), previous);
	}

	return {
		loadSeasonModel,
		loadEventAnalysis,
		loadEventAnalysisEntry,
		loadSeasonRatings,
		loadSeasonRatingsWithin,
		loadTeamRatingHistory,
		loadTeamRatingHistoryWithin,
		priorsForTeams
	};
}

export type Analysis = ReturnType<typeof createAnalysis>;

export const analysis = createAnalysis({ loaders: defaultLoaders, cache: sharedCache });

export const {
	loadEventAnalysis,
	loadEventAnalysisEntry,
	loadSeasonRatings,
	loadSeasonRatingsWithin,
	loadTeamRatingHistory,
	loadTeamRatingHistoryWithin,
	priorsForTeams
} = analysis;
