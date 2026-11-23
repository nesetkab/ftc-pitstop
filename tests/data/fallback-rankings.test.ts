import { describe, expect, it } from 'vitest';
import { matchScoreCheck } from '#lib/game/biobuzz.ts';
import { createCache } from '#lib/server/cache.ts';
import { createLoaders } from '#lib/server/event.ts';
import { createFtcClient } from '#lib/server/ftc/client.ts';
import { mapRankings } from '#lib/server/ftc/mappers.ts';
import type { FtcRankingsResponse } from '#lib/server/ftc/schemas.ts';
import { createFtcScoutClient, mapEventByCode } from '#lib/server/ftcscout.ts';
import { createNexusClient } from '#lib/server/nexus.ts';
import type { Ranking } from '#lib/types.ts';
import { fixture, fixtureFetch, scoutFetch, scoutFixture } from './helpers.ts';

const NOW = Date.parse('2026-11-23T12:00:00Z');

function fallback(scout: Record<string, string | object>) {
	const ftc = createFtcClient({
		username: 'tester',
		apiKey: 'not-a-real-key',
		fetch: fixtureFetch({ failPaths: /ftc-api/ }).fetch,
		sleep: async () => {}
	});
	return createLoaders({
		ftc,
		scout: createFtcScoutClient({ fetch: scoutFetch(scout).fetch, sleep: async () => {} }),
		nexus: createNexusClient(),
		cache: createCache({ onError: () => {}, now: () => NOW }),
		now: () => NOW
	});
}

function first(dir: string): Ranking[] {
	return mapRankings(fixture<FtcRankingsResponse>(dir, 'rankings'));
}

const round = (value: number) => Math.round(value * 10_000) / 10_000;

function view(rows: Ranking[]) {
	return rows.map((row) => [
		row.rank,
		row.team,
		round(row.rs),
		round(row.tbp),
		round(row.avgTips),
		round(row.avgAuto),
		row.wins,
		row.losses,
		row.ties,
		row.played
	]);
}

function scoutEvent(code: string) {
	return mapEventByCode(
		scoutFixture<{ data: Parameters<typeof mapEventByCode>[0] }>(`event-${code}`).data
	)!;
}

function leagueList(...events: { code: string; start: string }[]) {
	return {
		data: {
			eventsSearch: events.map((event) => ({
				...event,
				name: `Event ${event.code}`,
				type: 'LeagueMeet',
				end: event.start,
				regionCode: 'USFL',
				leagueCode: 'OR',
				hasMatches: true
			}))
		}
	};
}

describe.each([
	['USMTBUQ', 'USMTBUQ-final'],
	['AUPYQ', 'AUPYQ'],
	['UZTAQ1', 'UZTAQ1']
])('FTCScout fallback rankings at %s', (code, dir) => {
	it('equal the FIRST rankings', async () => {
		const bundle = await fallback({ EventByCode: `event-${code}` }).loadEventBundle(code);
		expect(bundle.source).toBe('ftcscout');
		expect(view(bundle.rankings)).toEqual(view(first(dir)));
	});

	it('use bonus ranking points that follow the BIOBUZZ thresholds', () => {
		const quals = scoutEvent(code).matches.filter((match) => match.level === 'qual');
		for (const match of quals) {
			if (!match.result) continue;
			const issues = matchScoreCheck(match.result);
			const rp = [...issues.red, ...issues.blue].filter((issue) =>
				['swarm', 'pollinator1', 'pollinator2'].includes(issue.field)
			);
			expect([match.key, rp]).toEqual([match.key, []]);
		}
	});
});

describe('FTCScout fallback rankings', () => {
	it('drop a team disqualified from every match to the bottom like FIRST', async () => {
		const scout = scoutEvent('UZTAQ1').rankings.find((row) => row.team === 35580)!;
		expect(scout.rank).toBe(6);
		const bundle = await fallback({ EventByCode: 'event-UZTAQ1' }).loadEventBundle('UZTAQ1');
		expect(bundle.rankings.find((row) => row.team === 35580)).toMatchObject({
			rank: 11,
			rs: 0,
			tbp: 0,
			played: 6,
			dq: 6
		});
	});

	it('divide by 10 at the first meet of a league, like FIRST', async () => {
		const data = fallback({
			EventByCode: 'event-USFLORM1',
			EventsSearch: leagueList(
				{ code: 'USFLORM1', start: '2026-11-14' },
				{ code: 'USFLORM2', start: '2026-12-05' }
			)
		});
		const bundle = await data.loadEventBundle('USFLORM1');
		expect(view(bundle.rankings)).toEqual(view(first('USFLORM1')));
		expect(bundle.rankings.every((row) => row.counted === 10)).toBe(true);
	});

	it('average per match at a later meet, since earlier meets are not loaded', async () => {
		const data = fallback({
			EventByCode: 'event-USFLORM1',
			EventsSearch: leagueList(
				{ code: 'USFLORM0', start: '2026-10-24' },
				{ code: 'USFLORM1', start: '2026-11-14' }
			)
		});
		const bundle = await data.loadEventBundle('USFLORM1');
		const official = new Map(first('USFLORM1').map((row) => [row.team, row]));
		for (const row of bundle.rankings) {
			const meet = official.get(row.team)!;
			expect(row.counted).toBeUndefined();
			expect(round(row.rs)).toBeCloseTo((meet.rs * 10) / row.played, 3);
		}
	});
});
