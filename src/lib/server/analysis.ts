import { createHash } from 'node:crypto';
import { analyzeEvent, retime } from '#lib/analysis/analyze.ts';
import {
	buildSeason,
	contextFor,
	eventRatings,
	teamHistory,
	type SeasonModel
} from '#lib/analysis/season.ts';
import type {
	AnalysisContext,
	EventAnalysis,
	SeasonEventRatings,
	SeasonRatings,
	TeamRatingHistory
} from '#lib/analysis/types.ts';
import { SEASON } from '#lib/game/biobuzz.ts';
import { dayNumber, previousFrom, type PriorRel } from '#lib/model/opr.ts';
import previousSeason from '#lib/model/previous-2025.json';
import {
	keepAlive,
	LruMap,
	cache as sharedCache,
	type Cache,
	type CachePolicy
} from '#lib/server/cache.ts';
import { DataError, describeError, unavailable } from '#lib/server/errors.ts';
import {
	analysisKey,
	ARCHIVE_POLICY,
	eventTier,
	isArchived,
	loaders as defaultLoaders,
	normalizeEventCode,
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
	return { ttl: 15, maxStale: 300 };
}

function fingerprint(bundle: EventBundle, season: SeasonModel | null): string {
	const content = JSON.stringify([
		season?.generatedAt ?? null,
		bundle.event,
		bundle.teams,
		bundle.matches,
		bundle.rankings,
		bundle.alliances,
		bundle.phase
	]);
	return createHash('sha1').update(content).digest('base64');
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
	previous?: Map<number, PriorRel>;
	now?: () => number;
	budgetMs?: number;
	background?: (task: Promise<unknown>) => void;
}

export function createAnalysis(deps: AnalysisDeps) {
	const { loaders, cache } = deps;
	const now = deps.now ?? Date.now;
	const previous = deps.previous ?? previousFrom(previousSeason);
	const budget = deps.budgetMs ?? 2500;
	const background = deps.background ?? keepAlive;
	let current: { model: SeasonModel; expires: number } | null = null;
	let pending: Promise<SeasonModel> | null = null;
	let pendingSince = 0;
	const analyzed = new LruMap<{ key: string; analysis: EventAnalysis }>(100);

	function analyzeOnce(
		bundle: EventBundle,
		season: SeasonModel | null,
		teams: number[],
		day: number
	) {
		const time = now();
		const key = fingerprint(bundle, season);
		const known = analyzed.get(bundle.event.code);
		if (known?.key === key) return retime(known.analysis, bundle, time);
		const context = contextFor(season, teams, day, previous);
		const analysis = analyzeEvent(bundle, context, { now: time });
		analyzed.set(bundle.event.code, { key, analysis });
		return analysis;
	}

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
					const kept = current?.model;
					if (!model.complete && kept?.complete && now() < kept.generatedAt + DAY_SECONDS * 1000) {
						current = { model: kept, expires: now() + 2 * MINUTE };
						return kept;
					}
					current = { model, expires: now() + (model.complete ? HOUR : 2 * MINUTE) };
					return model;
				})
				.finally(() => {
					pending = null;
				});
			if (current) {
				background(
					pending.catch((error: unknown) =>
						console.warn(`season ratings refresh failed: ${describeError(error)}`)
					)
				);
			}
		}
		if (current && time < current.model.generatedAt + DAY_SECONDS * 1000) {
			return Promise.resolve(current.model);
		}
		return pending;
	}

	async function loadEventAnalysisEntry(
		input: string
	): Promise<{ analysis: EventAnalysis; cacheControl: string }> {
		const code = normalizeEventCode(input);
		const model = loadSeasonModel();
		model.catch(() => undefined);
		const deadline = pending ? Math.max(now(), pendingSince + budget) : now() + budget;
		const { cacheControl, ...bundle } = await loaders.loadEventBundle(code);
		const teams = teamsOf(bundle);
		const day = dayNumber(bundle.event.start);
		const policy = isArchived(bundle.event, now())
			? ARCHIVE_POLICY
			: analysisPolicy(eventTier(bundle.event, now()), bundle.phase);
		try {
			const value = await cache.get<EventAnalysis>(
				analysisKey(bundle.event.code),
				policy,
				async () => {
					const season = await within(model, deadline - now()).catch(() => {
						throw new ColdStart();
					});
					return { status: 'ok', body: analyzeOnce(bundle, season, teams, day) };
				}
			);
			return { analysis: value.body, cacheControl };
		} catch (error) {
			if (!(error instanceof ColdStart)) throw error;
			background(model);
			return {
				analysis: analyzeOnce(bundle, null, teams, day),
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

	async function loadSeasonEventRatings(): Promise<SeasonEventRatings | null> {
		try {
			const value = await cache.get<SeasonEventRatings>(
				`analysis:${SEASON}:event-ratings:v1`,
				RATINGS_POLICY,
				async () => {
					const model = await loadSeasonModel();
					if (!model.complete) throw new Incomplete(model);
					return { status: 'ok', body: eventRatings(model) };
				}
			);
			return value.body;
		} catch (error) {
			if (error instanceof Incomplete) return eventRatings(error.model);
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

	function loadSeasonModelWithin(ms: number = budget): Promise<SeasonModel | null> {
		return settleWithin(loadSeasonModel(), ms);
	}

	function loadSeasonRatingsWithin(ms: number = budget): Promise<SeasonRatings | null> {
		return settleWithin(loadSeasonRatings(), ms);
	}

	function loadSeasonEventRatingsWithin(ms: number = budget): Promise<SeasonEventRatings | null> {
		return settleWithin(loadSeasonEventRatings(), ms);
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
		loadSeasonModelWithin,
		loadEventAnalysis,
		loadEventAnalysisEntry,
		loadSeasonRatings,
		loadSeasonRatingsWithin,
		loadSeasonEventRatings,
		loadSeasonEventRatingsWithin,
		loadTeamRatingHistory,
		loadTeamRatingHistoryWithin,
		priorsForTeams
	};
}

export const analysis = createAnalysis({ loaders: defaultLoaders, cache: sharedCache });

export const {
	loadSeasonModelWithin,
	loadEventAnalysis,
	loadEventAnalysisEntry,
	loadSeasonRatings,
	loadSeasonRatingsWithin,
	loadSeasonEventRatingsWithin,
	loadTeamRatingHistory,
	loadTeamRatingHistoryWithin,
	priorsForTeams
} = analysis;
