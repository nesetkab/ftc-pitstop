import * as z from 'zod';
import type { Rosters } from '#lib/components/event/strength.ts';
import { SEASON } from '#lib/game/biobuzz.ts';
import { cache as sharedCache, type Cache, type CachePolicy } from '#lib/server/cache.ts';
import { scoutClient } from '#lib/server/ftcscout.ts';

const DAY_SECONDS = 86_400;

export const ROSTERS_KEY = `scout:${SEASON}:rosters:v1`;
export const ROSTERS_POLICY: CachePolicy = { ttl: 3600, maxStale: 7 * DAY_SECONDS };

const rosterSchema = z.object({
	eventsSearch: z.array(
		z.object({
			code: z.string(),
			teams: z.array(z.object({ teamNumber: z.number(), stats: z.object({}).nullable() }))
		})
	)
});

export type ScoutRosters = z.infer<typeof rosterSchema>;

const DOCUMENT = `query EventRosters($season: Int!) { eventsSearch(season: $season) { code teams { teamNumber stats { __typename } } } }`;

export type PackedRosters = Record<string, number[]>;

export function packRosters(data: ScoutRosters): PackedRosters {
	const packed: PackedRosters = {};
	for (const event of data.eventsSearch) {
		packed[event.code.toUpperCase()] = event.teams.map((team) =>
			team.stats === null ? team.teamNumber : -team.teamNumber
		);
	}
	return packed;
}

export function unpackRosters(packed: PackedRosters): Rosters {
	const rosters: Rosters = {};
	for (const [code, teams] of Object.entries(packed)) {
		rosters[code] = {
			registered: teams.map(Math.abs),
			played: teams.filter((team) => team < 0).map((team) => -team)
		};
	}
	return rosters;
}

export function toRosters(data: ScoutRosters): Rosters {
	return unpackRosters(packRosters(data));
}

export function fetchScoutRosters(): Promise<ScoutRosters> {
	return scoutClient.query('EventRosters', DOCUMENT, { season: SEASON }, rosterSchema, {
		timeoutMs: 30_000
	});
}

export interface RosterDeps {
	cache: Cache;
	fetchRosters: () => Promise<ScoutRosters>;
}

export function createRosters(deps: RosterDeps) {
	let memo: { fetchedAt: number; rosters: Rosters } | null = null;

	async function loadRosters(): Promise<Rosters> {
		const value = await deps.cache.get<PackedRosters>(ROSTERS_KEY, ROSTERS_POLICY, async () => ({
			status: 'ok',
			body: packRosters(await deps.fetchRosters())
		}));
		if (memo?.fetchedAt !== value.fetchedAt) {
			memo = { fetchedAt: value.fetchedAt, rosters: unpackRosters(value.body) };
		}
		return memo.rosters;
	}

	return { loadRosters };
}

export const { loadRosters } = createRosters({
	cache: sharedCache,
	fetchRosters: fetchScoutRosters
});
