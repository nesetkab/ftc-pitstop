import * as z from 'zod';
import type { SeasonRatings } from '#lib/analysis/types.ts';
import {
	buildStrengthIndex,
	rankStrength,
	type RankedStrength,
	type Rosters,
	type StrengthIndex
} from '#lib/components/event/strength.ts';
import { SEASON } from '#lib/game/biobuzz.ts';
import { loadSeasonRatings } from '#lib/server/analysis.ts';
import {
	cache as sharedCache,
	settleWithin,
	type Cache,
	type CachePolicy
} from '#lib/server/cache.ts';
import { loadSeasonEvents } from '#lib/server/event.ts';
import { scoutClient } from '#lib/server/ftcscout.ts';
import type { EventSummary } from '#lib/types.ts';

const DAY_SECONDS = 86_400;
const WAIT_MS = 3_000;

export const STRENGTH_KEY = `strength:${SEASON}:v1`;
export const STRENGTH_POLICY: CachePolicy = { ttl: 3600, maxStale: 7 * DAY_SECONDS };

const rosterSchema = z.object({
	eventsSearch: z.array(
		z.object({
			code: z.string(),
			teams: z.array(z.object({ teamNumber: z.number(), stats: z.object({}).nullable() }))
		})
	)
});

const ROSTERS = `query EventRosters($season: Int!) { eventsSearch(season: $season) { code teams { teamNumber stats { __typename } } } }`;

export function toRosters(data: z.infer<typeof rosterSchema>): Rosters {
	const rosters: Rosters = {};
	for (const event of data.eventsSearch) {
		rosters[event.code.toUpperCase()] = {
			registered: event.teams.map((team) => team.teamNumber),
			played: event.teams.filter((team) => team.stats !== null).map((team) => team.teamNumber)
		};
	}
	return rosters;
}

async function fetchRosters(): Promise<Rosters> {
	const data = await scoutClient.query('EventRosters', ROSTERS, { season: SEASON }, rosterSchema, {
		timeoutMs: 30_000
	});
	return toRosters(data);
}

export interface StrengthDeps {
	cache: Cache;
	loadRosters: () => Promise<Rosters>;
	loadSeasonEvents: () => Promise<{ events: EventSummary[] }>;
	loadSeasonRatings: () => Promise<SeasonRatings | null>;
	now?: () => number;
}

export function createStrength(deps: StrengthDeps) {
	const now = deps.now ?? Date.now;
	let memo: { fetchedAt: number; ranked: RankedStrength } | null = null;

	async function build(): Promise<StrengthIndex> {
		const [rosters, list, ratings] = await Promise.all([
			deps.loadRosters(),
			deps.loadSeasonEvents(),
			deps.loadSeasonRatings()
		]);
		if (!ratings || ratings.teams.length === 0) throw new Error('Season ratings are not ready');
		return buildStrengthIndex({ events: list.events, rosters, ratings, now: now() });
	}

	async function loadStrength(): Promise<RankedStrength> {
		const value = await deps.cache.get<StrengthIndex>(STRENGTH_KEY, STRENGTH_POLICY, async () => ({
			status: 'ok',
			body: await build()
		}));
		if (memo?.fetchedAt !== value.fetchedAt) {
			memo = { fetchedAt: value.fetchedAt, ranked: rankStrength(value.body) };
		}
		return memo.ranked;
	}

	function loadStrengthWithin(ms = WAIT_MS): Promise<RankedStrength | null> {
		return settleWithin(loadStrength(), ms);
	}

	return { loadStrength, loadStrengthWithin };
}

export const strength = createStrength({
	cache: sharedCache,
	loadRosters: fetchRosters,
	loadSeasonEvents,
	loadSeasonRatings
});

export const { loadStrength, loadStrengthWithin } = strength;
