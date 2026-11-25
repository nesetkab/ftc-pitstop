import { describe, expect, it, vi } from 'vitest';
import { matchScoreCheck } from '#lib/game/biobuzz.ts';
import {
	awardSeasons,
	createFtcScoutClient,
	fetchAwardHistory,
	fetchEventByCode,
	fetchEventsOnDate,
	fetchSeasonMatches,
	fetchTeamSeason,
	FtcScoutError,
	scoutMatchKey,
	USER_AGENT
} from '#lib/server/ftcscout.ts';
import { scoutFetch, scoutFixture } from './helpers.ts';

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

	it('only keeps web addresses in the links of an event', async () => {
		const raw = scoutFixture<{ data: { eventByCode: Record<string, unknown> } }>('event-USAZGIQ');
		raw.data.eventByCode.liveStreamURL = 'javascript:alert(document.domain)';
		raw.data.eventByCode.website = 'https://user:pass@example.com/';
		raw.data.eventByCode.webcasts = [
			'data:text/html,<script>alert(1)</script>',
			' HTTPS://Twitch.tv/pitstop ',
			'vbscript:msgbox(1)',
			'www.twitch.tv/no-scheme'
		];
		const scout = createFtcScoutClient({ fetch: scoutFetch({ EventByCode: raw }).fetch });
		const event = (await fetchEventByCode('USAZGIQ', 2026, scout))?.event;
		expect(event).toMatchObject({
			liveStreamUrl: null,
			website: null,
			webcasts: ['https://twitch.tv/pitstop']
		});
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

	it('asks for past seasons back to the rookie year', () => {
		expect(awardSeasons(2022, 2026)).toEqual([2025, 2024, 2023, 2022]);
		expect(awardSeasons(2005, 2026)).toEqual([2025, 2024, 2023, 2022, 2021, 2020, 2019]);
		expect(awardSeasons(null, 2026)).toHaveLength(7);
		expect(awardSeasons(2026, 2026)).toEqual([]);
	});

	it('maps past awards to their event in one request', async () => {
		const fake = scoutFetch({
			AwardHistory: {
				data: {
					teamByNumber: {
						e2025: [
							{ eventCode: 'USUTQ1', event: { name: 'Utah Qualifier 1', start: '2025-11-15' } }
						],
						a2025: [
							{ eventCode: 'USUTQ1', type: 'Inspire', placement: 2, teamNumber: 3747, personName: null },
							{ eventCode: 'GONE', type: 'Think', placement: 1, teamNumber: 3747, personName: null }
						],
						e2024: [],
						a2024: []
					}
				}
			}
		});
		const awards = await fetchAwardHistory(
			3747,
			[2025, 2024],
			createFtcScoutClient({ fetch: fake.fetch })
		);
		expect(fake.bodies).toHaveLength(1);
		expect(fake.bodies[0].variables).toEqual({ number: 3747 });
		expect(fake.bodies[0].query).toContain('a2024: awards(season: 2024)');
		expect(awards).toEqual([
			{
				season: 2025,
				code: 'USUTQ1',
				event: 'Utah Qualifier 1',
				start: '2025-11-15',
				award: { id: 11, name: 'Inspire Award', placement: 2, team: 3747, person: null }
			}
		]);
		expect(await fetchAwardHistory(3747, [], createFtcScoutClient({ fetch: fake.fetch }))).toEqual(
			[]
		);
		expect(fake.bodies).toHaveLength(1);
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
		expect(fake.bodies[0].query).toContain('dcParkPoints2');
		expect(matches[0]).toMatchObject({
			eventCode: 'USUTSAS1',
			eventType: 'NonAdvancement',
			region: 'USUT',
			end: '2026-09-19',
			key: 'p1',
			red: {
				teams: [20515],
				noShows: [],
				total: 39,
				preFoulTotal: 39,
				auto: 3,
				teleop: 36,
				hive: 26,
				park: 10,
				tips: 1,
				leavePark: 13,
				robots: [8],
				rp: { swarm: false }
			},
			blue: { total: 29, garden: 3, leavePark: 18, robots: [13], rp: { swarm: true } }
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

describe('FTCScout politeness', () => {
	function failingClient(fetcher: () => Promise<Response>) {
		let time = Date.parse('2026-11-19T12:00:00Z');
		const fetch = vi.fn(fetcher);
		const scout = createFtcScoutClient({
			fetch: fetch as unknown as typeof fetch,
			sleep: async () => {},
			now: () => time
		});
		return {
			scout,
			fetch,
			advance: (seconds: number) => {
				time += seconds * 1000;
			}
		};
	}

	it('pauses a query that keeps failing instead of asking again on every request', async () => {
		let healthy = false;
		const data = failingClient(async () =>
			healthy
				? new Response(JSON.stringify(scoutFixture('team-2844')), { status: 200 })
				: new Response('<html>busy</html>', { status: 503 })
		);
		await expect(fetchTeamSeason(2844, 2026, data.scout)).rejects.toMatchObject({ status: 503 });
		expect(data.fetch).toHaveBeenCalledTimes(2);
		for (let i = 0; i < 5; i++) {
			await expect(fetchTeamSeason(2844, 2026, data.scout)).rejects.toBeInstanceOf(FtcScoutError);
		}
		expect(data.fetch).toHaveBeenCalledTimes(2);
		data.advance(61);
		await expect(fetchTeamSeason(2844, 2026, data.scout)).rejects.toMatchObject({ status: 503 });
		expect(data.fetch).toHaveBeenCalledTimes(4);
		data.advance(61);
		await expect(fetchTeamSeason(2844, 2026, data.scout)).rejects.toBeInstanceOf(FtcScoutError);
		expect(data.fetch).toHaveBeenCalledTimes(4);
		data.advance(60);
		healthy = true;
		expect((await fetchTeamSeason(2844, 2026, data.scout))?.team.number).toBe(2844);
		expect((await fetchTeamSeason(2844, 2026, data.scout))?.team.number).toBe(2844);
		expect(data.fetch).toHaveBeenCalledTimes(6);
	});

	it('keeps other queries going while one is paused', async () => {
		const data = failingClient(async () => new Response('busy', { status: 503 }));
		await expect(fetchTeamSeason(2844, 2026, data.scout)).rejects.toBeInstanceOf(FtcScoutError);
		await expect(fetchTeamSeason(3747, 2026, data.scout)).rejects.toBeInstanceOf(FtcScoutError);
		expect(data.fetch).toHaveBeenCalledTimes(4);
	});

	it('does not send a slow query twice', async () => {
		const data = failingClient(async () => {
			throw new DOMException('The operation timed out.', 'TimeoutError');
		});
		await expect(fetchTeamSeason(2844, 2026, data.scout)).rejects.toEqual(
			new FtcScoutError(504, 'FTCScout timed out')
		);
		expect(data.fetch).toHaveBeenCalledTimes(1);
	});

	it('tells a cut off response apart from one that is not JSON', async () => {
		const cut = failingClient(async () => {
			const body = new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode('{"data":{"team'));
					controller.error(new TypeError('terminated'));
				}
			});
			return new Response(body, { status: 200 });
		});
		await expect(fetchTeamSeason(2844, 2026, cut.scout)).rejects.toEqual(
			new FtcScoutError(502, 'FTCScout cut the response short')
		);
		const html = failingClient(
			async () =>
				new Response('<html>Just a moment...</html>', {
					status: 200,
					headers: { 'content-type': 'text/html; charset=UTF-8' }
				})
		);
		await expect(fetchTeamSeason(2844, 2026, html.scout)).rejects.toEqual(
			new FtcScoutError(502, 'FTCScout sent text/html instead of JSON')
		);
		const empty = failingClient(async () => new Response('null', { status: 200 }));
		await expect(fetchTeamSeason(2844, 2026, empty.scout)).rejects.toBeInstanceOf(FtcScoutError);
	});
});
