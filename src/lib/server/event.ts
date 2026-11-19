import { SEASON } from '#lib/game/biobuzz.ts';
import { detectPhase } from '#lib/game/phase.ts';
import {
	cache as defaultCache,
	type Cache,
	type CachedValue,
	type CachePolicy
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
	createFtcScoutClient,
	fetchEventByCode,
	fetchEventsOnDate,
	fetchQuickStats,
	fetchSeasonEvents,
	fetchSeasonMatches,
	fetchTeamSeason,
	type FtcScoutClient
} from '#lib/server/ftcscout.ts';
import { nexus as defaultNexus, type NexusClient } from '#lib/server/nexus.ts';
import { addDays, localDate, startOfLocalDay } from '#lib/server/time.ts';
import type {
	Event,
	EventBundle,
	EventPhase,
	EventSummary,
	QueueStatusSnapshot,
	QuickStats,
	SearchIndex,
	SearchTeam,
	SeasonMatch,
	TeamSeason
} from '#lib/types.ts';

const HOUR = 3_600_000;
const DAY_SECONDS = 86_400;

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

export function cacheControlFor(tier: EventTier, phase: EventPhase): string {
	if (tier === 'finished') return 'public, s-maxage=86400';
	if (tier === 'upcoming') return 'public, s-maxage=300, stale-while-revalidate=3600';
	if (phase === 'done') return 'public, s-maxage=300, stale-while-revalidate=3600';
	return 'public, s-maxage=30, stale-while-revalidate=300';
}

export function normalizeEventCode(input: string): string {
	const code = input.trim().toUpperCase();
	if (!/^[A-Z0-9]{2,24}$/.test(code)) throw notFound('Event not found');
	return code;
}

export function normalizeTeamNumber(input: string | number): number {
	const number = Number(input);
	if (!Number.isInteger(number) || number <= 0 || number > 999_999)
		throw notFound('Team not found');
	return number;
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

	function ftcPart<E extends FtcEndpoint>(
		endpoint: E,
		path: string,
		policy: CachePolicy
	): Promise<CachedValue<FtcBody<E>>> {
		return cache.get<FtcBody<E>>(`ftc:${SEASON}:${path}`, policy, (previous) =>
			ftcEndpoint(ftc, endpoint, path, { ifModifiedSince: previous?.lastModified })
		);
	}

	function teamsPart(code: string, policy: CachePolicy) {
		return cache.get(`ftc:${SEASON}:${ftcPaths.teams(code)}:all`, policy, async () => ({
			status: 'ok' as const,
			body: await ftcAllPages(ftc, (page) => ftcPaths.teams(code, page))
		}));
	}

	function cachedEventTier(code: string, time: number): EventTier {
		const entry = cache.peek(`ftc:${SEASON}:${ftcPaths.event(code)}`);
		const raw = (entry?.body as FtcBody<'event'> | undefined)?.events?.[0];
		return raw ? eventTier(mapEvent(raw), time) : 'live';
	}

	async function scoutBundle(code: string, time: number): Promise<LoadedBundle> {
		let value: CachedValue<Awaited<ReturnType<typeof fetchEventByCode>>>;
		try {
			value = await cache.get(
				`scout:${SEASON}:event:${code}`,
				{ ttl: 30, maxStale: 3600 },
				async () => ({
					status: 'ok',
					body: await fetchEventByCode(code, SEASON, scout)
				})
			);
		} catch {
			throw unavailable('Event data is unavailable right now');
		}
		const data = value.body;
		if (!data) throw notFound('Event not found');
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
			rankings: data.rankings,
			alliances: [],
			awards: data.awards,
			advancement: null,
			phase,
			fetchedAt: value.fetchedAt,
			stale: true,
			source: 'ftcscout',
			cacheControl: cacheControlFor(tier, phase)
		};
	}

	async function loadEventBundle(input: string): Promise<LoadedBundle> {
		const code = normalizeEventCode(input);
		const time = now();
		const hint = phases.get(code) ?? null;
		let eventValue: CachedValue<FtcBody<'event'>>;
		try {
			eventValue = await ftcPart(
				'event',
				ftcPaths.event(code),
				policyFor('event', cachedEventTier(code, time), hint)
			);
		} catch (error) {
			if (isNotFound(error)) throw notFound('Event not found');
			return scoutBundle(code, time);
		}
		const rawEvent = eventValue.body.events[0];
		if (!rawEvent) throw notFound('Event not found');
		const event = mapEvent(rawEvent);
		const tier = eventTier(event, time);
		const policy = (part: BundlePart) => policyFor(part, tier, hint);

		const [teams, qualSchedule, playoffSchedule] = await Promise.all([
			settle(teamsPart(code, policy('teams'))),
			settle(ftcPart('schedule', ftcPaths.schedule(code, 'qual'), policy('scheduleQual'))),
			settle(ftcPart('schedule', ftcPaths.schedule(code, 'playoff'), policy('schedulePlayoff')))
		]);

		const quals = qualSchedule.body?.schedule ?? [];
		const playoffs = playoffSchedule.body?.schedule ?? [];
		const anyQualPlayed = quals.some(played);
		const allQualsPlayed = quals.length > 0 && quals.every(played);
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
		const phase = detectPhase({
			event,
			matches,
			alliances: allianceList,
			awards: awardList,
			now: time,
			endsAt: eventWindow(event).endsAt
		});
		phases.set(code, phase);

		const advancement =
			phase === 'done'
				? await settle(
						ftcPart(
							'advancement',
							ftcPaths.advancement(code),
							policyFor('advancement', tier, phase)
						)
					)
				: null;

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

		return {
			event,
			teams: teams.body ? mapTeams(teams.body) : [],
			matches,
			rankings: rankings.body ? mapRankings(rankings.body) : [],
			alliances: allianceList,
			awards: awardList,
			advancement: advancement?.body ? mapAdvancement(advancement.body) : null,
			phase,
			fetchedAt: live.length > 0 ? Math.min(...live) : eventValue.fetchedAt,
			stale: eventValue.stale || parts.some((part) => part.stale) || Boolean(advancement?.stale),
			source: 'ftc',
			cacheControl: cacheControlFor(tier, phase)
		};
	}

	async function ftcSeasonEvents(): Promise<EventSummary[]> {
		const value = await ftcPart('event', ftcPaths.seasonEvents(), {
			ttl: 3600,
			maxStale: 7 * DAY_SECONDS
		});
		if (value.body.events.length === 0) throw unavailable('Event list is empty');
		return value.body.events.map((raw) => summarizeEvent(mapEvent(raw))).sort(compareEvents);
	}

	async function loadSeasonEvents(): Promise<{
		events: EventSummary[];
		fetchedAt: number;
		stale: boolean;
	}> {
		try {
			const value = await cache.get(
				`scout:${SEASON}:events`,
				{ ttl: 3600, maxStale: 7 * DAY_SECONDS },
				async () => {
					const events = await fetchSeasonEvents(SEASON, scout);
					if (events.length === 0) throw unavailable('Event list is empty');
					return { status: 'ok', body: events };
				}
			);
			return { events: value.body, fetchedAt: value.fetchedAt, stale: value.stale };
		} catch {
			try {
				return { events: await ftcSeasonEvents(), fetchedAt: now(), stale: true };
			} catch {
				throw unavailable('Event list is unavailable right now');
			}
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
		try {
			const value = await cache.get(
				`scout:${SEASON}:team:${number}`,
				{ ttl: 300, maxStale: DAY_SECONDS },
				async () => ({ status: 'ok', body: await fetchTeamSeason(number, SEASON, scout) })
			);
			if (!value.body) return null;
			return { ...value.body, fetchedAt: value.fetchedAt, stale: value.stale };
		} catch {
			try {
				return await ftcTeamSeason(number);
			} catch (error) {
				if (isNotFound(error)) return null;
				throw unavailable('Team data is unavailable right now');
			}
		}
	}

	async function loadSeasonTeams(): Promise<CachedValue<SearchTeam[]>> {
		return cache.get(
			`ftc:${SEASON}:teams:all`,
			{ ttl: DAY_SECONDS, maxStale: 7 * DAY_SECONDS },
			async () => {
				const pages = await ftcAllPages(ftc, (page) => ftcPaths.seasonTeams(page));
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

	async function loadSeasonMatches(
		options: { from?: string; to?: string } = {}
	): Promise<{ matches: SeasonMatch[]; fetchedAt: number; stale: boolean }> {
		const today = localDate(now(), 'UTC');
		const from = options.from ?? `${SEASON}-09-01`;
		const to = options.to ?? today;
		const matches = new Map<string, SeasonMatch>();
		let fetchedAt = now();
		let stale = false;
		for (let start = from; start <= to; start = addDays(start, 7)) {
			const weekEnd = addDays(start, 6);
			const end = addDays(start, 13);
			const settled = end < addDays(today, -7);
			const policy = settled
				? { ttl: DAY_SECONDS, maxStale: 30 * DAY_SECONDS }
				: { ttl: 600, maxStale: DAY_SECONDS };
			try {
				const value = await cache.get(`scout:${SEASON}:matches:${start}`, policy, async () => ({
					status: 'ok',
					body: await fetchSeasonMatches({ season: SEASON, start, end }, scout)
				}));
				fetchedAt = Math.min(fetchedAt, value.fetchedAt);
				stale ||= value.stale;
				for (const match of value.body) {
					if (match.date < start || match.date > weekEnd) continue;
					matches.set(`${match.eventCode}:${match.key}`, match);
				}
			} catch {
				stale = true;
			}
		}
		return { matches: [...matches.values()], fetchedAt, stale };
	}

	return {
		loadEventBundle,
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
	scout: createFtcScoutClient(),
	nexus: defaultNexus,
	cache: defaultCache
});

export const {
	loadEventBundle,
	loadSeasonEvents,
	loadEventsToday,
	loadTeamSeason,
	searchIndex,
	loadQueueStatus,
	loadPriorQuickStats,
	loadSeasonMatches
} = loaders;

export { DataError };
