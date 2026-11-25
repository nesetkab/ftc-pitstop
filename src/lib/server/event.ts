import { SEASON } from '#lib/game/biobuzz.ts';
import { detectPhase, lastPosted, WINNER_AWARD_ID } from '#lib/game/phase.ts';
import { rankingsFromMatches } from '#lib/game/rankings.ts';
import {
	cache as defaultCache,
	LruMap,
	settleWithin,
	type Cache,
	type CachedValue,
	type CachePolicy,
	type PolicyChoice
} from '#lib/server/cache.ts';
import { DataError, notFound, unavailable } from '#lib/server/errors.ts';
import {
	compareMatches,
	ftc as defaultFtc,
	ftcAllPages,
	ftcEndpoint,
	ftcPaths,
	isNotFound,
	mapAdvancement,
	mapAlliances,
	mapAwards,
	mapEvent,
	mapMatches,
	mapRankings,
	mapTeams,
	summarizeEvent,
	type FtcBody,
	type FtcClient,
	type FtcEndpoint,
	type FtcScheduleMatch
} from '#lib/server/ftc/index.ts';
import {
	compareEvents,
	fetchEventByCode,
	fetchEventsOnDate,
	fetchQuickStats,
	fetchSeasonEvents,
	fetchSeasonMatches,
	fetchTeamSeason,
	scoutClient,
	type FtcScoutClient,
	type ScoutEventData
} from '#lib/server/ftcscout.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { nexus as defaultNexus, type NexusClient } from '#lib/server/nexus.ts';
import { addDays, localDate, startOfLocalDay } from '#lib/format/calendar.ts';
import type {
	Award,
	Event,
	EventBundle,
	EventPhase,
	EventSummary,
	Match,
	QueueStatusSnapshot,
	QuickStats,
	SearchIndex,
	SearchTeam,
	SeasonMatch,
	TeamSeason
} from '#lib/types.ts';

const HOUR = 3_600_000;
const DAY_SECONDS = 86_400;
const MISS_MS = 5 * 60_000;
const LIST_RETRY_MS = 30_000;
const LIST_WAIT_MS = 1_000;
const LIST_HEDGE_MS = 2_000;
const LIST_PEEK_MS = 250;
const LIST_TIMEOUT_MS = 6_000;
const BUNDLE_BUDGET_MS = 5_000;
const FALLBACK_MIN_MS = 1_500;
const TEAM_WAIT_MS = 3_000;
const SEASON_WEEKS_AT_ONCE = 3;
const AWARDS_WAIT_MS = 2 * HOUR;
const EVENT_LIST_POLICY: CachePolicy = { ttl: 3600, maxStale: 7 * DAY_SECONDS };
const ARCHIVE_AFTER_MS = 7 * 24 * HOUR;
export const ARCHIVE_POLICY: CachePolicy = { ttl: 7 * DAY_SECONDS, maxStale: 7 * DAY_SECONDS };
const ACTIVE_TEAM_POLICY: CachePolicy = { ttl: 300, maxStale: DAY_SECONDS };
const QUIET_TEAM_POLICY: CachePolicy = { ttl: 6 * 3600, maxStale: 2 * DAY_SECONDS };
const EVENT_CODE_PATTERN = /^[A-Z0-9]{2,24}$/;
const TEAM_NUMBER_PATTERN = /^[1-9]\d{0,4}$/;

class TeamMissing extends Error {
	constructor() {
		super('Team not found');
		this.name = 'TeamMissing';
	}
}

export type EventTier = 'upcoming' | 'live' | 'finished';

export type BundlePart =
	| 'event'
	| 'teams'
	| 'scheduleQual'
	| 'schedulePlayoff'
	| 'scoresQual'
	| 'scoresPlayoff'
	| 'rankings'
	| 'alliances'
	| 'awards'
	| 'advancement';

export const LIVE_TTL: Record<BundlePart, number> = {
	event: 300,
	teams: 300,
	scheduleQual: 15,
	schedulePlayoff: 15,
	scoresQual: 20,
	scoresPlayoff: 15,
	rankings: 20,
	alliances: 20,
	awards: 60,
	advancement: 300
};

export function eventWindow(event: Pick<Event, 'start' | 'end' | 'timezone'>) {
	const startsAt = startOfLocalDay(event.start, event.timezone);
	const nextDay = startOfLocalDay(addDays(event.end, 1), event.timezone);
	return {
		startsAt,
		endsAt: nextDay === null ? null : nextDay + 6 * HOUR
	};
}

export function eventTier(
	event: Pick<Event, 'start' | 'end' | 'timezone'>,
	now: number
): EventTier {
	const { startsAt, endsAt } = eventWindow(event);
	if (startsAt !== null && now < startsAt - 12 * HOUR) return 'upcoming';
	if (endsAt !== null && now >= endsAt + 6 * HOUR) return 'finished';
	return 'live';
}

export function analysisKey(code: string): string {
	return `analysis:${SEASON}:event:v1:${code}`;
}

export function isArchived(event: Pick<Event, 'start' | 'end' | 'timezone'>, now: number): boolean {
	const { endsAt } = eventWindow(event);
	return endsAt !== null && now >= endsAt + ARCHIVE_AFTER_MS;
}

export function teamPolicy(season: Pick<TeamSeason, 'events'> | null, now: number): CachePolicy {
	if (!season) return ACTIVE_TEAM_POLICY;
	const today = localDate(now, 'UTC');
	const active = season.events.some(
		({ event }) => addDays(event.start, -2) <= today && today <= addDays(event.end, 3)
	);
	return active ? ACTIVE_TEAM_POLICY : QUIET_TEAM_POLICY;
}

export function policyFor(
	part: BundlePart,
	tier: EventTier,
	phase: EventPhase | null
): CachePolicy {
	if (tier === 'finished') return { ttl: DAY_SECONDS, maxStale: 7 * DAY_SECONDS };
	if (tier === 'upcoming')
		return { ttl: part === 'scheduleQual' ? 600 : 1800, maxStale: DAY_SECONDS };
	if (phase === 'done') return { ttl: 300, maxStale: DAY_SECONDS };
	return { ttl: LIVE_TTL[part], maxStale: 300 };
}

export function cachePhase(
	phase: EventPhase,
	matches: Match[],
	awards: Award[],
	now: number,
	endsAt: number | null
): EventPhase {
	if (phase !== 'done' || (endsAt !== null && now >= endsAt)) return phase;
	if (awards.some((award) => award.id === WINNER_AWARD_ID)) return phase;
	const last = lastPosted(matches);
	return last !== null && now - last < AWARDS_WAIT_MS ? 'playoffs' : phase;
}

export function cacheControlFor(tier: EventTier, phase: EventPhase, stale = false): string {
	if (tier === 'finished') return stale ? CACHE_CONTROL.short : CACHE_CONTROL.finished;
	if (tier === 'upcoming' || phase === 'done') return CACHE_CONTROL.short;
	return CACHE_CONTROL.live;
}

export function normalizeEventCode(input: string): string {
	const code = input.toUpperCase();
	if (!EVENT_CODE_PATTERN.test(code)) throw notFound('Event not found');
	return code;
}

export function normalizeTeamNumber(input: string | number): number {
	const text = String(input);
	if (!TEAM_NUMBER_PATTERN.test(text)) throw notFound('Team not found');
	return Number(text);
}

interface Settled<T> {
	body: T | null;
	fetchedAt: number | null;
	stale: boolean;
}

async function settle<T>(task: Promise<CachedValue<T>> | null): Promise<Settled<T>> {
	if (!task) return { body: null, fetchedAt: null, stale: false };
	try {
		const value = await task;
		return { body: value.body, fetchedAt: value.fetchedAt, stale: value.stale };
	} catch {
		return { body: null, fetchedAt: null, stale: true };
	}
}

type Outcome<T> = { value: T } | { error: unknown };

function outcomeWithin<T>(task: Promise<T>, ms: number): Promise<Outcome<T> | null> {
	return settleWithin(
		task.then(
			(value): Outcome<T> => ({ value }),
			(error: unknown): Outcome<T> => ({ error })
		),
		ms
	);
}

function played(match: FtcScheduleMatch): boolean {
	return match.scoreRedFinal != null && match.scoreBlueFinal != null;
}

function isRealTeam(team: SearchTeam): boolean {
	return !/^off-?season demo/i.test(team.name);
}

export interface LoaderDeps {
	ftc: FtcClient;
	scout: FtcScoutClient;
	nexus: NexusClient;
	cache: Cache;
	now?: () => number;
}

export interface LoadedBundle extends EventBundle {
	cacheControl: string;
}

export function createLoaders(deps: LoaderDeps) {
	const { ftc, scout, nexus, cache } = deps;
	const now = deps.now ?? Date.now;
	const phases = new Map<string, EventPhase>();
	const misses = new LruMap<number>(500);
	const listRetryAt = { scout: 0, ftc: 0 };
	const codeSets = new WeakMap<object, Set<string>>();
	const building = new Map<string, Promise<LoadedBundle>>();

	function rememberMiss(key: string) {
		misses.set(key, now() + MISS_MS);
	}

	function recentlyMissed(key: string): boolean {
		const until = misses.get(key);
		return until !== undefined && until > now();
	}

	function ftcPart<E extends FtcEndpoint>(
		endpoint: E,
		path: string,
		policy: PolicyChoice<FtcBody<E>>,
		timeoutMs?: number
	): Promise<CachedValue<FtcBody<E>>> {
		return cache.get<FtcBody<E>>(`ftc:${SEASON}:${path}`, policy, (previous) =>
			ftcEndpoint(ftc, endpoint, path, { ifModifiedSince: previous?.lastModified, timeoutMs })
		);
	}

	function codesOf(list: readonly { code: string }[]): Set<string> {
		let codes = codeSets.get(list);
		if (!codes) {
			codes = new Set(list.map((item) => item.code.toUpperCase()));
			codeSets.set(list, codes);
		}
		return codes;
	}

	async function listedCodes(source: 'scout' | 'ftc'): Promise<Set<string> | null> {
		if (now() < listRetryAt[source]) return null;
		try {
			if (source === 'scout') return codesOf((await scoutEventList()).body);
			return codesOf((await ftcSeasonList()).body.events);
		} catch {
			listRetryAt[source] = now() + LIST_RETRY_MS;
			return null;
		}
	}

	async function listedSoon(source: 'scout' | 'ftc'): Promise<Set<string> | null> {
		const task = listedCodes(source);
		const codes = await settleWithin(task, LIST_WAIT_MS);
		if (codes === null && now() >= listRetryAt[source]) {
			listRetryAt[source] = now() + LIST_RETRY_MS;
		}
		return codes;
	}

	function budgetFrom(begun: number): number {
		return Math.max(FALLBACK_MIN_MS, BUNDLE_BUDGET_MS - (performance.now() - begun));
	}

	async function isKnownEvent(code: string): Promise<boolean> {
		const scoutCodes = await listedSoon('scout');
		if (scoutCodes?.has(code)) return true;
		const ftcCodes = await listedSoon('ftc');
		if (ftcCodes?.has(code)) return true;
		return scoutCodes === null && ftcCodes === null;
	}

	function ftcSeasonList() {
		return ftcPart('event', ftcPaths.seasonEvents(), EVENT_LIST_POLICY, LIST_TIMEOUT_MS);
	}

	function scoutEventList() {
		return cache.get(`scout:${SEASON}:events`, EVENT_LIST_POLICY, async () => {
			const events = await fetchSeasonEvents(SEASON, scout);
			if (events.length === 0) throw unavailable('Event list is empty');
			return { status: 'ok', body: events };
		});
	}

	function teamsPart(code: string, policy: CachePolicy) {
		return cache.get(`ftc:${SEASON}:${ftcPaths.teams(code)}:all`, policy, async () => ({
			status: 'ok' as const,
			body: await ftcAllPages(ftc, (page) => ftcPaths.teams(code, page))
		}));
	}

	function eventPartPolicy(time: number, hint: EventPhase | null) {
		return (body: FtcBody<'event'> | null): CachePolicy => {
			const raw = body?.events?.[0];
			if (!raw) return policyFor('event', 'live', hint);
			const event = mapEvent(raw);
			if (isArchived(event, time)) return ARCHIVE_POLICY;
			return policyFor('event', eventTier(event, time), hint);
		};
	}

	function prefetchEvent(code: string) {
		const paths = [
			ftcPaths.event(code),
			`${ftcPaths.teams(code)}:all`,
			ftcPaths.schedule(code, 'qual'),
			ftcPaths.schedule(code, 'playoff'),
			ftcPaths.scores(code, 'qual'),
			ftcPaths.scores(code, 'playoff'),
			ftcPaths.rankings(code),
			ftcPaths.alliances(code),
			ftcPaths.awards(code),
			ftcPaths.advancement(code)
		];
		cache.prefetch([...paths.map((path) => `ftc:${SEASON}:${path}`), analysisKey(code)]);
	}

	function scoutRankings(data: ScoutEventData) {
		if (data.event.remote) return data.rankings;
		const events = cache.peek(`scout:${SEASON}:events`)?.body as EventSummary[] | undefined;
		return rankingsFromMatches(
			data.event,
			data.matches,
			data.teams.map((team) => team.number),
			events ?? null
		);
	}

	async function scoutBundle(
		code: string,
		time: number,
		required = true,
		waitMs = BUNDLE_BUDGET_MS
	): Promise<LoadedBundle> {
		const value = await settleWithin(
			cache.get(`scout:${SEASON}:event:${code}`, { ttl: 30, maxStale: 3600 }, async () => ({
				status: 'ok',
				body: await fetchEventByCode(code, SEASON, scout)
			})),
			waitMs
		);
		if (!value) throw unavailable('Event data is unavailable right now');
		const data = value.body;
		if (!data && !required) throw unavailable('Event data is unavailable right now');
		if (!data) {
			rememberMiss(`event:${code}`);
			throw notFound('Event not found');
		}
		const tier = eventTier(data.event, time);
		const phase = detectPhase({
			event: data.event,
			matches: data.matches,
			alliances: [],
			awards: data.awards,
			now: time,
			endsAt: eventWindow(data.event).endsAt
		});
		return {
			event: data.event,
			teams: data.teams,
			matches: [...data.matches].sort(compareMatches),
			rankings: scoutRankings(data),
			alliances: [],
			awards: data.awards,
			advancement: null,
			phase,
			fetchedAt: value.fetchedAt,
			stale: true,
			source: 'ftcscout',
			cacheControl: cacheControlFor(tier, phase, true)
		};
	}

	async function loadEventBundle(input: string): Promise<LoadedBundle> {
		const code = normalizeEventCode(input);
		const running = building.get(code);
		if (running) return running;
		const task = buildEventBundle(code).finally(() => building.delete(code));
		building.set(code, task);
		return task;
	}

	async function buildEventBundle(code: string): Promise<LoadedBundle> {
		const time = now();
		const begun = performance.now();
		if (recentlyMissed(`event:${code}`) || !(await isKnownEvent(code))) {
			throw notFound('Event not found');
		}
		prefetchEvent(code);
		const hint = phases.get(code) ?? null;
		let eventValue: CachedValue<FtcBody<'event'>>;
		try {
			eventValue = await ftcPart('event', ftcPaths.event(code), eventPartPolicy(time, hint));
		} catch (error) {
			if (isNotFound(error)) {
				rememberMiss(`event:${code}`);
				throw notFound('Event not found');
			}
			return scoutBundle(code, time, true, budgetFrom(begun));
		}
		const rawEvent = eventValue.body.events[0];
		if (!rawEvent) {
			rememberMiss(`event:${code}`);
			throw notFound('Event not found');
		}
		const event = mapEvent(rawEvent);
		const tier = eventTier(event, time);
		const archived = isArchived(event, time);
		const policy = (part: BundlePart) => (archived ? ARCHIVE_POLICY : policyFor(part, tier, hint));

		const [teams, qualSchedule, playoffSchedule] = await Promise.all([
			settle(teamsPart(code, policy('teams'))),
			settle(ftcPart('schedule', ftcPaths.schedule(code, 'qual'), policy('scheduleQual'))),
			settle(ftcPart('schedule', ftcPaths.schedule(code, 'playoff'), policy('schedulePlayoff')))
		]);

		if (qualSchedule.body === null) {
			const fallback = await scoutBundle(code, time, false, budgetFrom(begun)).catch(() => null);
			if (fallback) return fallback;
		}

		const quals = qualSchedule.body?.schedule ?? [];
		const playoffs = playoffSchedule.body?.schedule ?? [];
		const anyQualPlayed = quals.some(played);
		const lastQual = quals.reduce<FtcScheduleMatch | null>(
			(latest, match) => (!latest || match.matchNumber > latest.matchNumber ? match : latest),
			null
		);
		const allQualsPlayed = lastQual !== null && played(lastQual);
		const anyPlayoffPlayed = playoffs.some(played);
		const finished = tier === 'finished';
		const started = anyQualPlayed || anyPlayoffPlayed;

		const [qualScores, playoffScores, rankings, alliances, awards] = await Promise.all([
			settle(
				anyQualPlayed
					? ftcPart('scores', ftcPaths.scores(code, 'qual'), policy('scoresQual'))
					: null
			),
			settle(
				anyPlayoffPlayed
					? ftcPart('scores', ftcPaths.scores(code, 'playoff'), policy('scoresPlayoff'))
					: null
			),
			settle(
				anyQualPlayed ? ftcPart('rankings', ftcPaths.rankings(code), policy('rankings')) : null
			),
			settle(
				allQualsPlayed || playoffs.length > 0 || (finished && started)
					? ftcPart('alliances', ftcPaths.alliances(code), policy('alliances'))
					: null
			),
			settle(
				started || finished ? ftcPart('awards', ftcPaths.awards(code), policy('awards')) : null
			)
		]);

		const matches = mapMatches({
			timezone: event.timezone,
			qualSchedule: qualSchedule.body,
			playoffSchedule: playoffSchedule.body,
			qualScores: qualScores.body,
			playoffScores: playoffScores.body
		});
		const allianceList = alliances.body ? mapAlliances(alliances.body) : [];
		const awardList = awards.body ? mapAwards(awards.body) : [];
		const endsAt = eventWindow(event).endsAt;
		const phase = detectPhase({
			event,
			matches,
			alliances: allianceList,
			awards: awardList,
			now: time,
			endsAt
		});
		const caching = cachePhase(phase, matches, awardList, time, endsAt);
		phases.set(code, caching);

		const advancement =
			phase === 'done'
				? await settle(
						ftcPart(
							'advancement',
							ftcPaths.advancement(code),
							archived ? ARCHIVE_POLICY : policyFor('advancement', tier, phase)
						)
					)
				: null;

		const advancementList = advancement?.body ? mapAdvancement(advancement.body) : null;
		if (advancementList?.advancesTo) {
			const target = advancementList.advancesTo;
			const season = await settleWithin(loadSeasonEvents(), LIST_HEDGE_MS);
			advancementList.advancesToName =
				season?.events.find((entry) => entry.code === target)?.name ?? null;
		}

		const parts = [
			teams,
			qualSchedule,
			playoffSchedule,
			qualScores,
			playoffScores,
			rankings,
			alliances,
			awards
		];
		const live = [
			qualSchedule,
			playoffSchedule,
			qualScores,
			playoffScores,
			rankings,
			alliances,
			awards
		]
			.map((part) => part.fetchedAt)
			.filter((value): value is number => value !== null);

		const stale =
			eventValue.stale || parts.some((part) => part.stale) || Boolean(advancement?.stale);

		return {
			event,
			teams: teams.body ? mapTeams(teams.body) : [],
			matches,
			rankings: rankings.body ? mapRankings(rankings.body) : [],
			alliances: allianceList,
			awards: awardList,
			advancement: advancementList,
			phase,
			fetchedAt: live.length > 0 ? Math.min(...live) : eventValue.fetchedAt,
			stale,
			source: 'ftc',
			cacheControl: cacheControlFor(tier, caching, stale)
		};
	}

	async function ftcSeasonEvents(): Promise<EventSummary[]> {
		const value = await ftcSeasonList();
		if (value.body.events.length === 0) throw unavailable('Event list is empty');
		return value.body.events.map((raw) => summarizeEvent(mapEvent(raw))).sort(compareEvents);
	}

	async function loadSeasonEvents(): Promise<{
		events: EventSummary[];
		fetchedAt: number;
		stale: boolean;
	}> {
		const fromScout = scoutEventList().then((value) => ({
			events: value.body,
			fetchedAt: value.fetchedAt,
			stale: value.stale
		}));
		const hedge = cache.peek(`ftc:${SEASON}:${ftcPaths.seasonEvents()}`)
			? LIST_PEEK_MS
			: LIST_HEDGE_MS;
		const early = await settleWithin(fromScout, hedge);
		if (early) return early;
		const fromFtc = ftcSeasonEvents().then((events) => ({ events, fetchedAt: now(), stale: true }));
		try {
			return await Promise.any([fromScout, fromFtc]);
		} catch {
			throw unavailable('Event list is unavailable right now');
		}
	}

	async function loadEventsToday(): Promise<EventSummary[]> {
		const time = now();
		const isToday = (event: EventSummary) => {
			const today = localDate(time, event.timezone);
			return event.start <= today && today <= event.end;
		};
		try {
			const { events } = await loadSeasonEvents();
			return events.filter(isToday);
		} catch {
			const date = localDate(time, 'UTC');
			try {
				const value = await cache.get(
					`scout:${SEASON}:on:${date}`,
					{ ttl: 600, maxStale: DAY_SECONDS },
					async () => ({ status: 'ok', body: await fetchEventsOnDate(date, scout) })
				);
				return value.body.filter(isToday);
			} catch {
				throw unavailable('Event list is unavailable right now');
			}
		}
	}

	async function ftcTeamSeason(number: number): Promise<TeamSeason | null> {
		const policy = { ttl: 3600, maxStale: 7 * DAY_SECONDS };
		const [team, events] = await Promise.all([
			ftcPart('teams', `teams?teamNumber=${number}`, policy),
			ftcPart('event', `events?teamNumber=${number}`, policy).catch(() => null)
		]);
		const raw = team.body.teams[0];
		if (!raw) return null;
		const summaries = (events?.body.events ?? []).map((event) => summarizeEvent(mapEvent(event)));
		return {
			team: mapTeams([team.body])[0],
			events: summaries.sort(compareEvents).map((event) => ({ event, stats: null, awards: [] })),
			quickStats: null,
			previousQuickStats: null,
			fetchedAt: team.fetchedAt,
			stale: true
		};
	}

	async function loadTeamSeason(input: string | number): Promise<TeamSeason | null> {
		const number = normalizeTeamNumber(input);
		if (recentlyMissed(`team:${number}`)) return null;
		const begun = performance.now();
		const primary = await outcomeWithin(
			cache.get(
				`scout:${SEASON}:team:${number}`,
				(body) => teamPolicy(body, now()),
				async () => {
					const body = await fetchTeamSeason(number, SEASON, scout);
					if (!body) throw new TeamMissing();
					return { status: 'ok', body };
				}
			),
			TEAM_WAIT_MS
		);
		if (primary && 'value' in primary) {
			const { value } = primary;
			if (!value.body) return null;
			return { ...value.body, fetchedAt: value.fetchedAt, stale: value.stale };
		}
		if (primary?.error instanceof TeamMissing) {
			rememberMiss(`team:${number}`);
			return null;
		}
		const fallback = await outcomeWithin(ftcTeamSeason(number), budgetFrom(begun));
		if (fallback && 'value' in fallback) return fallback.value;
		if (fallback && isNotFound(fallback.error)) return null;
		throw unavailable('Team data is unavailable right now');
	}

	async function loadSeasonTeams(): Promise<CachedValue<SearchTeam[]>> {
		return cache.get(
			`ftc:${SEASON}:teams:all`,
			{ ttl: DAY_SECONDS, maxStale: 7 * DAY_SECONDS },
			async () => {
				const pages = await ftcAllPages(ftc, (page) => ftcPaths.seasonTeams(page), 4, {
					timeoutMs: LIST_TIMEOUT_MS
				});
				const teams = mapTeams(pages)
					.map((team) => ({
						number: team.number,
						name: team.name,
						city: team.city,
						state: team.state,
						country: team.country
					}))
					.filter(isRealTeam);
				if (teams.length === 0) throw unavailable('Team list is empty');
				return { status: 'ok', body: teams };
			}
		);
	}

	async function searchIndex(): Promise<SearchIndex> {
		const [teams, events] = await Promise.all([
			loadSeasonTeams().catch(() => null),
			loadSeasonEvents().catch(() => null)
		]);
		if (!teams && !events) throw unavailable('Search is unavailable right now');
		const times = [teams?.fetchedAt, events?.fetchedAt].filter(
			(value): value is number => value != null
		);
		return {
			teams: teams?.body ?? [],
			events: events?.events ?? [],
			fetchedAt: Math.min(...times)
		};
	}

	async function loadQueueStatus(input: string): Promise<QueueStatusSnapshot | null> {
		const code = normalizeEventCode(input);
		if (!nexus.configured) return null;
		if (recentlyMissed(`event:${code}`) || !(await isKnownEvent(code))) {
			throw notFound('Event not found');
		}
		try {
			const value = await cache.get(
				`nexus:${SEASON}:${code}`,
				{ ttl: 10, maxStale: 60 },
				async () => ({
					status: 'ok',
					body: await nexus.eventStatus(code)
				})
			);
			return value.body;
		} catch {
			throw unavailable('Queue status is unavailable right now');
		}
	}

	async function loadPriorQuickStats(numbers: number[]): Promise<Map<number, QuickStats>> {
		const season = SEASON - 1;
		const policy = { ttl: 7 * DAY_SECONDS, maxStale: 30 * DAY_SECONDS };
		const key = (number: number) => `scout:${season}:quick:${number}`;
		const unique = [...new Set(numbers.filter((number) => Number.isInteger(number) && number > 0))];
		const missing = unique.filter((number) => {
			const entry = cache.peek(key(number));
			return !entry || now() - entry.fetchedAt >= policy.ttl * 1000;
		});
		const batch = missing.length > 0 ? fetchQuickStats(missing, season, scout) : null;
		batch?.catch(() => null);
		const result = new Map<number, QuickStats>();
		await Promise.all(
			unique.map(async (number) => {
				try {
					const value = await cache.get<QuickStats | null>(key(number), policy, async () => {
						const stats = batch ? await batch : new Map<number, QuickStats>();
						return { status: 'ok', body: stats.get(number) ?? null };
					});
					if (value.body) result.set(number, value.body);
				} catch {
					return;
				}
			})
		);
		return result;
	}

	function weekKey(start: string): string {
		return `scout:${SEASON}:matches:v2:${start}`;
	}

	async function loadSeasonWeek(start: string, today: string) {
		const end = addDays(start, 10);
		const policy =
			end < addDays(today, -7)
				? { ttl: DAY_SECONDS, maxStale: 30 * DAY_SECONDS }
				: { ttl: 600, maxStale: DAY_SECONDS };
		return cache.get(weekKey(start), policy, async () => ({
			status: 'ok',
			body: await fetchSeasonMatches({ season: SEASON, start, end }, scout)
		}));
	}

	async function loadSeasonMatches(options: { from?: string; to?: string } = {}): Promise<{
		matches: SeasonMatch[];
		fetchedAt: number;
		stale: boolean;
		missing: string[];
	}> {
		const today = localDate(now(), 'UTC');
		const from = options.from ?? `${SEASON}-09-01`;
		const to = options.to ?? today;
		const weeks: string[] = [];
		for (let start = from; start <= to; start = addDays(start, 7)) weeks.push(start);
		cache.prefetch(weeks.map(weekKey));
		const loaded: (Awaited<ReturnType<typeof loadSeasonWeek>> | null)[] = [];
		let next = 0;
		const worker = async () => {
			while (next < weeks.length) {
				const index = next++;
				loaded[index] = await loadSeasonWeek(weeks[index], today).catch(() => null);
			}
		};
		await Promise.all(Array.from({ length: SEASON_WEEKS_AT_ONCE }, worker));
		const matches = new Map<string, SeasonMatch>();
		let fetchedAt = now();
		let stale = false;
		const missing: string[] = [];
		weeks.forEach((start, i) => {
			const value = loaded[i];
			if (!value) {
				missing.push(start);
				return;
			}
			fetchedAt = Math.min(fetchedAt, value.fetchedAt);
			stale ||= value.stale;
			const weekEnd = addDays(start, 6);
			for (const match of value.body) {
				if (match.date < start || match.date > weekEnd) continue;
				matches.set(`${match.eventCode}:${match.key}`, match);
			}
		});
		return {
			matches: [...matches.values()],
			fetchedAt,
			stale: stale || missing.length > 0,
			missing
		};
	}

	function finishedEvents(): string[] {
		return [...phases].filter(([, phase]) => phase === 'done').map(([code]) => code);
	}

	return {
		loadEventBundle,
		finishedEvents,
		loadSeasonEvents,
		loadEventsToday,
		loadTeamSeason,
		searchIndex,
		loadQueueStatus,
		loadPriorQuickStats,
		loadSeasonMatches
	};
}

export type Loaders = ReturnType<typeof createLoaders>;

export const loaders = createLoaders({
	ftc: defaultFtc,
	scout: scoutClient,
	nexus: defaultNexus,
	cache: defaultCache
});

export const {
	loadEventBundle,
	finishedEvents,
	loadSeasonEvents,
	loadEventsToday,
	loadTeamSeason,
	searchIndex,
	loadQueueStatus,
	loadPriorQuickStats,
	loadSeasonMatches
} = loaders;

export { DataError };
