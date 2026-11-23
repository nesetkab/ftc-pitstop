import * as z from 'zod';
import { SEASON } from '#lib/game/biobuzz.ts';
import { cache, keepAlive } from '#lib/server/cache.ts';
import { scoutClient as scout } from '#lib/server/ftcscout.ts';
import { localDate } from '#lib/format/calendar.ts';
import type { EventSummary } from '#lib/types.ts';

const DAY = 86_400;
const WAIT_MS = 3_000;

const schema = z.object({
	eventsSearch: z.array(
		z.object({
			code: z.string(),
			teams: z.array(z.object({ teamNumber: z.number(), stats: z.object({}).nullable() }))
		})
	)
});

const DOCUMENT = `query EventsSearch($season: Int!) { eventsSearch(season: $season) { code teams { teamNumber stats { __typename } } } }`;

export interface TeamCount {
	registered: number;
	played: number;
}

export type TeamCounts = Record<string, TeamCount>;

export function countTeams(data: z.infer<typeof schema>): TeamCounts {
	const counts: TeamCounts = {};
	for (const event of data.eventsSearch) {
		counts[event.code.toUpperCase()] = {
			registered: event.teams.length,
			played: event.teams.filter((team) => team.stats !== null).length
		};
	}
	return counts;
}

export function teamCount(
	event: Pick<EventSummary, 'end' | 'timezone'>,
	count: TeamCount | undefined,
	now: number
): number | null {
	if (!count) return null;
	const over = event.end < localDate(now, event.timezone);
	return (over && count.played > 0 ? count.played : count.registered) || null;
}

function fetchCounts() {
	return cache.get(
		`scout:${SEASON}:event-team-counts:played`,
		{ ttl: 3600, maxStale: 7 * DAY },
		async () => {
			const data = await scout.query('EventsSearch', DOCUMENT, { season: SEASON }, schema, {
				timeoutMs: 30_000
			});
			return { status: 'ok', body: countTeams(data) };
		}
	);
}

export async function loadTeamCounts(): Promise<TeamCounts | null> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), WAIT_MS);
	});
	const counts = fetchCounts().then(
		(value) => value.body,
		() => null
	);
	keepAlive(counts);
	try {
		return await Promise.race([counts, timeout]);
	} finally {
		clearTimeout(timer);
	}
}
