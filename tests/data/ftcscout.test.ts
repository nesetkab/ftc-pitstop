import { describe, expect, it, vi } from 'vitest';
import { matchScoreCheck } from '#lib/game/biobuzz.ts';
import {
	createFtcScoutClient,
	fetchEventByCode,
	fetchEventsOnDate,
	fetchSeasonMatches,
	fetchTeamSeason,
	FtcScoutError,
	scoutMatchKey,
	USER_AGENT
} from '#lib/server/ftcscout.ts';
import { scoutFetch } from './helpers.ts';

describe('FTCScout client', () => {
	it('names operations and sends a user agent', async () => {
		const fake = scoutFetch({ EventByCode: 'event-USAZGIQ' });
		await fetchEventByCode('USAZGIQ', 2026, createFtcScoutClient({ fetch: fake.fetch }));
		expect(fake.bodies[0]).toMatchObject({
			operationName: 'EventByCode',
			variables: { season: 2026, code: 'USAZGIQ' }
		});
		expect(fake.bodies[0].query).toMatch(/^query EventByCode\(/);
		expect(fake.calls[0].headers['user-agent']).toBe(USER_AGENT);
		expect(fake.calls[0].url).toBe('https://api.ftcscout.org/graphql');
	});

	it('maps an event with matches, scores, rankings and awards', async () => {
		const scout = createFtcScoutClient({
			fetch: scoutFetch({ EventByCode: 'event-USAZGIQ' }).fetch
		});
		const data = await fetchEventByCode('USAZGIQ', 2026, scout);
		expect(data?.event).toMatchObject({
			code: 'USAZGIQ',
			type: 'Qualifier',
			timezone: 'America/Phoenix',
			start: '2026-11-14'
		});
		expect(data?.matches).toHaveLength(44);
		expect(data?.teams).toHaveLength(28);
		expect(data?.rankings).toHaveLength(27);
		expect(data?.rankings.some((ranking) => ranking.team === 14855)).toBe(false);
		expect(data?.rankings[0]).toMatchObject({
			rank: 1,
			team: 26670,
			rs: 4.4,
			tbp: 95,
			avgTips: 3.6,
			avgAuto: 32.4
		});
		const q1 = data!.matches.find((match) => match.key === 'q1')!;
		expect(new Date(q1.scheduledTime!).toISOString()).toBe('2026-11-14T17:30:00.000Z');
		expect(q1.red.map((team) => team.team)).toEqual([26670, 32043]);
		expect(q1.result?.blue.breakdown?.teleop.flowers.red).toEqual(['pollen', 'pollen']);
		const issues = data!.matches.flatMap((match) => {
			if (!match.result) return [];
			const { red, blue } = matchScoreCheck(match.result);
			return [...red, ...blue].map((issue) => `${match.label} ${issue.field}`);
		});
		expect(issues).toEqual([]);
		expect(data?.awards.find((award) => award.id === 11 && award.placement === 3)).toMatchObject({
			name: 'Inspire Award',
			team: 2844
		});
	});

	it('maps finals-only brackets the same way as the FTC mapper', async () => {
		const scout = createFtcScoutClient({
			fetch: scoutFetch({ EventByCode: 'event-USALATQ' }).fetch
		});
		const data = await fetchEventByCode('USALATQ', 2026, scout);
		const playoffs = data!.matches.filter((match) => match.level === 'playoff');
		expect(playoffs.map((match) => [match.key, match.label])).toEqual([
			['p1', 'F1'],
			['p2', 'F2']
		]);
		expect(scoutMatchKey('DoubleElim', 10, 1)).toEqual({
			key: 'p10',
			label: 'M10',
			level: 'playoff'
		});
		expect(scoutMatchKey('Quals', 0, 7)).toEqual({ key: 'q7', label: 'Q7', level: 'qual' });
	});

	it('maps a team season and unknown teams', async () => {
		const scout = createFtcScoutClient({ fetch: scoutFetch({ TeamSeason: 'team-2844' }).fetch });
		const season = await fetchTeamSeason(2844, 2026, scout);
		expect(season?.quickStats).toMatchObject({ season: 2026, total: { rank: 345 }, count: 3272 });
		expect(season?.events[0].stats).toMatchObject({
			played: 5,
			opr: { total: expect.closeTo(47.36, 2) }
		});
		const none = createFtcScoutClient({ fetch: scoutFetch({ TeamSeason: 'team-missing' }).fetch });
		expect(await fetchTeamSeason(999998, 2026, none)).toBeNull();
	});

	it('asks for events on a date at noon UTC', async () => {
		const fake = scoutFetch({ EventsOnDate: 'events-on-2026-11-14' });
		const events = await fetchEventsOnDate(
			'2026-11-14',
			createFtcScoutClient({ fetch: fake.fetch })
		);
		expect(fake.bodies[0].variables).toEqual({ date: '2026-11-14T12:00:00.000Z' });
		expect(events.every((event) => event.start <= '2026-11-14' && event.end >= '2026-11-14')).toBe(
			true
		);
	});

	it('maps bulk season matches with RP parts', async () => {
		const fake = scoutFetch({ EventsSearch: 'season-matches-2026-09-19' });
		const matches = await fetchSeasonMatches(
			{ start: '2026-09-19', end: '2026-09-20' },
			createFtcScoutClient({ fetch: fake.fetch })
		);
		expect(fake.bodies[0].query).toContain('hasMatches: true');
		expect(matches[0]).toMatchObject({
			eventCode: 'USUTSAS1',
			eventType: 'NonAdvancement',
			key: 'p1',
			red: {
				total: 39,
				preFoulTotal: 39,
				auto: 3,
				teleop: 36,
				tips: 1,
				leavePark: 13,
				rp: { swarm: false }
			},
			blue: { total: 29, leavePark: 18, rp: { swarm: true } }
		});
	});

	it('turns failures into short errors', async () => {
		const down = createFtcScoutClient({
			fetch: (async () => new Response('<html>524</html>', { status: 524 })) as typeof fetch,
			sleep: async () => {}
		});
		await expect(fetchEventByCode('USAZGIQ', 2026, down)).rejects.toEqual(
			new FtcScoutError(524, 'FTCScout error 524')
		);
		const broken = createFtcScoutClient({
			fetch: (async () => Response.json({ errors: [{ message: 'boom' }] })) as typeof fetch
		});
		await expect(fetchEventByCode('USAZGIQ', 2026, broken)).rejects.toMatchObject({
			message: 'FTCScout rejected the query'
		});
		const offline = vi.fn(async () => {
			throw new TypeError('fetch failed');
		});
		const unreachable = createFtcScoutClient({
			fetch: offline as unknown as typeof fetch,
			sleep: async () => {}
		});
		await expect(fetchEventByCode('USAZGIQ', 2026, unreachable)).rejects.toMatchObject({
			status: 502
		});
		expect(offline).toHaveBeenCalledTimes(2);
	});
});
