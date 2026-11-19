import * as z from 'zod';
import { SEASON } from '#lib/game/biobuzz.ts';
import { cache } from '#lib/server/cache.ts';
import { createFtcScoutClient } from '#lib/server/ftcscout.ts';

const DAY = 86_400;
const WAIT_MS = 8_000;

const scout = createFtcScoutClient();

const schema = z.object({
	eventsSearch: z.array(
		z.object({
			code: z.string(),
			teams: z.array(z.object({ teamNumber: z.number() }))
		})
	)
});

const DOCUMENT = `query EventsSearch($season: Int!) { eventsSearch(season: $season) { code teams { teamNumber } } }`;

function fetchCounts() {
	return cache.get(
		`scout:${SEASON}:event-team-counts`,
		{ ttl: 3600, maxStale: 7 * DAY },
		async () => {
			const data = await scout.query('EventsSearch', DOCUMENT, { season: SEASON }, schema, {
				timeoutMs: 30_000
			});
			const counts: Record<string, number> = {};
			for (const event of data.eventsSearch) counts[event.code.toUpperCase()] = event.teams.length;
			return { status: 'ok', body: counts };
		}
	);
}

export async function loadTeamCounts(): Promise<Record<string, number> | null> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), WAIT_MS);
	});
	const counts = fetchCounts().then(
		(value) => value.body,
		() => null
	);
	try {
		return await Promise.race([counts, timeout]);
	} finally {
		clearTimeout(timer);
	}
}
