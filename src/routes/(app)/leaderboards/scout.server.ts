import * as z from 'zod';
import type { LeaderboardRow } from '#lib/components/team/leaderboard.ts';
import { SEASON } from '#lib/game/biobuzz.ts';
import { cache as defaultCache, type Cache } from '#lib/server/cache.ts';
import { createFtcScoutClient, type FtcScoutClient } from '#lib/server/ftcscout.ts';

const PAGE = 50;
const DEFAULT_LIMIT = 500;
const CONCURRENCY = 5;

const QUERY = `query TepRecords($season: Int!, $skip: Int!, $take: Int!) {
	tepRecords(season: $season, sortBy: "opr", sortDir: Desc, skip: $skip, take: $take) {
		count
		data {
			data {
				teamNumber
				team { name location { city state country } }
				event { regionCode }
				stats { ... on TeamEventStats2026 { qualMatchesPlayed opr { totalPointsNp autoPoints dcPoints tips } } }
			}
		}
	}
}`;

const schema = z.object({
	tepRecords: z.object({
		count: z.number(),
		data: z.array(
			z.object({
				data: z.object({
					teamNumber: z.number(),
					team: z.object({
						name: z.string(),
						location: z
							.object({
								city: z.string().nullish(),
								state: z.string().nullish(),
								country: z.string().nullish()
							})
							.nullish()
					}),
					event: z.object({ regionCode: z.string().nullish() }),
					stats: z
						.object({
							qualMatchesPlayed: z.number(),
							opr: z.object({
								totalPointsNp: z.number(),
								autoPoints: z.number(),
								dcPoints: z.number(),
								tips: z.number()
							})
						})
						.nullish()
				})
			})
		)
	})
});

export interface ScoutLeaderboardDeps {
	scout?: FtcScoutClient;
	cache?: Cache;
	limit?: number;
}

export interface ScoutLeaderboard {
	rows: LeaderboardRow[];
	fetchedAt: number;
}

export function createScoutLeaderboard(deps: ScoutLeaderboardDeps = {}) {
	const scout = deps.scout ?? createFtcScoutClient();
	const cache = deps.cache ?? defaultCache;
	const limit = deps.limit ?? DEFAULT_LIMIT;

	async function fetchRows(): Promise<LeaderboardRow[]> {
		const offsets = Array.from({ length: Math.ceil(limit / PAGE) }, (_, index) => index * PAGE);
		const pages: z.output<typeof schema>[] = [];
		for (let index = 0; index < offsets.length; index += CONCURRENCY) {
			const batch = offsets
				.slice(index, index + CONCURRENCY)
				.map((skip) =>
					scout.query('TepRecords', QUERY, { season: SEASON, skip, take: PAGE }, schema)
				);
			pages.push(...(await Promise.all(batch)));
		}
		const best = new Map<number, LeaderboardRow>();
		for (const page of pages) {
			for (const { data: entry } of page.tepRecords.data) {
				if (best.has(entry.teamNumber) || !entry.stats) continue;
				const place = entry.team.location;
				best.set(entry.teamNumber, {
					team: entry.teamNumber,
					name: entry.team.name,
					city: place?.city ?? null,
					state: place?.state ?? null,
					country: place?.country ?? null,
					region: entry.event.regionCode ?? null,
					opr: entry.stats.opr.totalPointsNp,
					auto: entry.stats.opr.autoPoints,
					teleop: entry.stats.opr.dcPoints,
					tips: entry.stats.opr.tips,
					matches: entry.stats.qualMatchesPlayed,
					events: null
				});
			}
		}
		return [...best.values()];
	}

	async function load(): Promise<ScoutLeaderboard> {
		const value = await cache.get<LeaderboardRow[]>(
			`scout:${SEASON}:leaderboard`,
			{ ttl: 3600, maxStale: 6 * 3600 },
			async () => ({ status: 'ok', body: await fetchRows() })
		);
		return { rows: value.body, fetchedAt: value.fetchedAt };
	}

	return { load };
}

export const scoutLeaderboard = createScoutLeaderboard();
