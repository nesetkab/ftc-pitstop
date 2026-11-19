import { createCache } from '#lib/server/cache.ts';
import { createLoaders } from '#lib/server/event.ts';
import { createFtcClient } from '#lib/server/ftc/client.ts';
import { createFtcScoutClient, fetchTeamSeason } from '#lib/server/ftcscout.ts';
import { createNexusClient } from '#lib/server/nexus.ts';
import type { TeamSeason } from '#lib/types.ts';
import { fixtureFetch, scoutFetch } from '../../../../tests/data/helpers.ts';

export function fixtureLoaders(now = '2026-11-19T12:00:00Z') {
	const time = Date.parse(now);
	return createLoaders({
		ftc: createFtcClient({
			username: 'tester',
			apiKey: 'not-a-real-key',
			fetch: fixtureFetch().fetch,
			sleep: async () => {}
		}),
		scout: createFtcScoutClient({ fetch: scoutFetch({}).fetch, sleep: async () => {} }),
		nexus: createNexusClient({}),
		cache: createCache({ onError: () => {}, now: () => time }),
		now: () => time
	});
}

export async function scoutTeamSeason(fixture: string, number: number): Promise<TeamSeason> {
	const scout = createFtcScoutClient({
		fetch: scoutFetch({ TeamSeason: fixture }).fetch,
		sleep: async () => {}
	});
	const season = await fetchTeamSeason(number, 2026, scout);
	if (!season) throw new Error(`No team in fixture ${fixture}`);
	return { ...season, fetchedAt: Date.parse('2026-11-19T12:00:00Z'), stale: false };
}
