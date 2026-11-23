import {
	buildAdvancementIndex,
	eventResult,
	FEEDER_TYPES,
	type AdvancementIndex,
	type EventResult
} from '#lib/components/advancement/advancement.ts';
import { eventStatus } from '#lib/components/event/dates.ts';
import { SEASON } from '#lib/game/biobuzz.ts';
import {
	redisStore,
	settleWithin,
	cache as sharedCache,
	type Cache,
	type CacheEntry,
	type CachePolicy,
	type CacheStore
} from '#lib/server/cache.ts';
import { loadSeasonEvents, searchIndex } from '#lib/server/event.ts';
import { ftcPaths } from '#lib/server/ftc/endpoints.ts';
import { mapAdvancement, mapAwards } from '#lib/server/ftc/mappers.ts';
import type { FtcAdvancementResponse, FtcAwardsResponse } from '#lib/server/ftc/schemas.ts';
import { getRedis } from '#lib/server/redis.ts';
import type { EventSummary } from '#lib/types.ts';

const DAY_MS = 86_400_000;
const DAY_SECONDS = 86_400;
const SETTLED_MS = 14 * DAY_MS;
const READ_TIMEOUT_MS = 3_000;
const NAMES_WAIT_MS = 2_000;
const BUILD_BUCKET_MS = 10 * 60_000;

export const ADVANCEMENT_KEY = `advancement:${SEASON}:v1`;
export const ADVANCEMENT_POLICY: CachePolicy = { ttl: 3600, maxStale: 30 * DAY_SECONDS };

export interface StoredAdvancement {
	results: Record<string, EventResult>;
}

export interface AdvancementDeps {
	cache: Cache;
	store: CacheStore | null;
	loadSeasonEvents: () => Promise<{ events: EventSummary[]; fetchedAt: number }>;
	teamNames: () => Promise<ReadonlyMap<number, string> | null>;
	now?: () => number;
}

export function advancementKeys(code: string) {
	return {
		advancement: `ftc:${SEASON}:${ftcPaths.advancement(code)}`,
		awards: `ftc:${SEASON}:${ftcPaths.awards(code)}`
	};
}

function settled(result: EventResult, event: EventSummary, time: number): boolean {
	const ended = Date.parse(`${event.end}T00:00:00Z`);
	return time - ended > SETTLED_MS && (result.advancesTo === null || result.teams.length > 0);
}

export function createAdvancement(deps: AdvancementDeps) {
	const { cache, store } = deps;
	const now = deps.now ?? Date.now;
	const memo = new Map<string, EventResult>();
	let built: { key: string; index: AdvancementIndex } | null = null;

	async function readEntries(keys: string[]): Promise<Map<string, CacheEntry>> {
		const found = new Map<string, CacheEntry>();
		const missing: string[] = [];
		for (const key of keys) {
			const entry = cache.peek(key);
			if (entry?.body) found.set(key, entry);
			else missing.push(key);
		}
		if (!store || missing.length === 0) return found;
		const loaded = await settleWithin(
			Promise.all(missing.map((key) => store.get(key).catch(() => null))),
			READ_TIMEOUT_MS
		);
		loaded?.forEach((entry, index) => {
			if (entry?.body) found.set(missing[index], entry);
		});
		return found;
	}

	async function collect(previous: StoredAdvancement | null): Promise<StoredAdvancement> {
		const time = now();
		const { events } = await deps.loadSeasonEvents();
		const results: Record<string, EventResult> = { ...previous?.results };
		for (const [code, result] of memo) {
			if ((results[code]?.fetchedAt ?? -1) < result.fetchedAt) results[code] = result;
		}
		const wanted = events.filter(
			(event) =>
				FEEDER_TYPES.has(event.type) &&
				eventStatus(event, time) === 'done' &&
				!(results[event.code] && settled(results[event.code], event, time))
		);
		if (wanted.length > 0) {
			const keys = wanted.flatMap((event) => Object.values(advancementKeys(event.code)));
			const [entries, names] = await Promise.all([
				readEntries(keys),
				deps.teamNames().catch(() => null)
			]);
			for (const event of wanted) {
				const parts = advancementKeys(event.code);
				const advancement = entries.get(parts.advancement);
				const known = results[event.code];
				if (!advancement || (known && known.fetchedAt >= advancement.fetchedAt)) continue;
				const awards = entries.get(parts.awards)?.body as FtcAwardsResponse | undefined;
				const fallback = new Map(
					known?.teams.flatMap((team) => (team.name ? [[team.team, team.name]] : []))
				);
				results[event.code] = eventResult(
					event.code,
					mapAdvancement(advancement.body as FtcAdvancementResponse),
					awards ? mapAwards(awards) : [],
					names ?? fallback,
					advancement.fetchedAt
				);
			}
		}
		for (const [code, result] of Object.entries(results)) memo.set(code, result);
		return { results };
	}

	async function loadAdvancement(): Promise<{ index: AdvancementIndex; stale: boolean }> {
		const [stored, list] = await Promise.all([
			cache.get<StoredAdvancement>(ADVANCEMENT_KEY, ADVANCEMENT_POLICY, async (previous) => ({
				status: 'ok',
				body: await collect(previous?.body ?? null)
			})),
			deps.loadSeasonEvents()
		]);
		const time = now();
		const key = `${stored.fetchedAt}:${list.fetchedAt}:${Math.floor(time / BUILD_BUCKET_MS)}`;
		if (built?.key !== key) {
			const index = buildAdvancementIndex({
				events: list.events,
				results: stored.body.results,
				now: time
			});
			built = { key, index: { ...index, generatedAt: stored.fetchedAt } };
		}
		return { index: built.index, stale: stored.stale };
	}

	return { loadAdvancement };
}

export type AdvancementLoader = ReturnType<typeof createAdvancement>;

let directory: { fetchedAt: number; names: Map<number, string> } | null = null;

async function seasonTeamNames(): Promise<ReadonlyMap<number, string> | null> {
	const index = await settleWithin(searchIndex(), NAMES_WAIT_MS);
	if (!index) return directory?.names ?? null;
	if (directory?.fetchedAt !== index.fetchedAt) {
		directory = {
			fetchedAt: index.fetchedAt,
			names: new Map(index.teams.map((team) => [team.number, team.name]))
		};
	}
	return directory.names;
}

function defaultStore(): CacheStore | null {
	const redis = getRedis();
	return redis ? redisStore(redis) : null;
}

export const advancement = createAdvancement({
	cache: sharedCache,
	store: defaultStore(),
	loadSeasonEvents,
	teamNames: seasonTeamNames
});

export const { loadAdvancement } = advancement;
