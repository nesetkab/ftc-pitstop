import type * as z from 'zod';
import type { FtcClient, FtcRequestOptions, FtcResponse } from './client.ts';
import {
	ftcAdvancementResponse,
	ftcAlliancesResponse,
	ftcAwardsResponse,
	ftcEventsResponse,
	ftcMatchesResponse,
	ftcRankingsResponse,
	ftcScheduleResponse,
	ftcScoresResponse,
	ftcTeamsResponse
} from './schemas.ts';

export type FtcLevel = 'qual' | 'playoff';

export const ftcPaths = {
	event: (code: string) => `events?eventCode=${code}`,
	seasonEvents: () => 'events',
	teams: (code: string, page = 1) =>
		page > 1 ? `teams?eventCode=${code}&page=${page}` : `teams?eventCode=${code}`,
	seasonTeams: (page = 1) => `teams?page=${page}`,
	rankings: (code: string) => `rankings/${code}`,
	schedule: (code: string, level: FtcLevel) => `schedule/${code}/${level}/hybrid`,
	matches: (code: string, level: FtcLevel) => `matches/${code}?tournamentLevel=${level}`,
	scores: (code: string, level: FtcLevel) => `scores/${code}/${level}`,
	alliances: (code: string) => `alliances/${code}`,
	awards: (code: string) => `awards/${code}`,
	advancement: (code: string) => `advancement/${code}`
};

export const ftcSchemas = {
	event: ftcEventsResponse,
	teams: ftcTeamsResponse,
	rankings: ftcRankingsResponse,
	schedule: ftcScheduleResponse,
	matches: ftcMatchesResponse,
	scores: ftcScoresResponse,
	alliances: ftcAlliancesResponse,
	awards: ftcAwardsResponse,
	advancement: ftcAdvancementResponse
};

export type FtcEndpoint = keyof typeof ftcSchemas;

export type FtcBody<E extends FtcEndpoint> = z.output<(typeof ftcSchemas)[E]>;

export function ftcEndpoint<E extends FtcEndpoint>(
	client: FtcClient,
	endpoint: E,
	path: string,
	init?: FtcRequestOptions
): Promise<FtcResponse<FtcBody<E>>> {
	return client.get(path, ftcSchemas[endpoint], init) as Promise<FtcResponse<FtcBody<E>>>;
}

export async function ftcAllPages(
	client: FtcClient,
	pathFor: (page: number) => string,
	concurrency = 4,
	init: FtcRequestOptions = {}
): Promise<FtcBody<'teams'>[]> {
	const first = await ftcEndpoint(client, 'teams', pathFor(1), init);
	if (first.status !== 'ok') return [];
	const total = Math.min(first.body.pageTotal ?? 1, 200);
	const pages: FtcBody<'teams'>[] = [first.body];
	for (let page = 2; page <= total; page += concurrency) {
		const batch = Array.from(
			{ length: Math.min(concurrency, total - page + 1) },
			(_, i) => page + i
		);
		const responses = await Promise.all(
			batch.map((n) => ftcEndpoint(client, 'teams', pathFor(n), init))
		);
		for (const response of responses) if (response.status === 'ok') pages.push(response.body);
	}
	return pages;
}
