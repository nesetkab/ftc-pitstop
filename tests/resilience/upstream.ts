import { readFileSync } from 'node:fs';
import { fixture, fixtureFetch, SCOUT_FIXTURES } from '../data/helpers.ts';

const CODE = 'USAZGIQ';
const TEAM = 2844;

export const REDIS_URL = 'https://fake-redis.upstash.io';

export type Mode = 'ok' | 'hang' | 'down' | 'error' | 'denied' | 'garbage';

export interface Modes {
	ftc: Mode;
	scout: Mode;
	nexus: Mode;
	redis: Mode;
}

export const HEALTHY: Modes = { ftc: 'ok', scout: 'ok', nexus: 'ok', redis: 'ok' };

type Host = keyof Modes;

function scoutJson(name: string): string {
	return readFileSync(`${SCOUT_FIXTURES}${name}.json`, 'utf8');
}

const SEASON_LIST = JSON.stringify({
	data: {
		eventsSearch: [
			{
				code: 'USAZGIQ',
				name: 'Arizona Gila Qualifier',
				type: 'Qualifier',
				start: '2026-11-14',
				end: '2026-11-14',
				timezone: 'America/Phoenix'
			}
		]
	}
});

const TEP_RECORDS = JSON.stringify({
	data: {
		tepRecords: {
			count: 1,
			data: [
				{
					data: {
						teamNumber: 2844,
						team: { name: 'Robots', location: { city: 'Mesa', state: 'AZ', country: 'USA' } },
						event: { regionCode: 'USAZ' },
						stats: {
							qualMatchesPlayed: 5,
							opr: { totalPointsNp: 80, autoPoints: 20, dcPoints: 60, tips: 0 }
						}
					}
				}
			]
		}
	}
});

function scoutBody(request: {
	operationName?: string;
	query?: string;
	variables?: Record<string, unknown>;
}) {
	switch (request.operationName) {
		case 'EventsSearch':
			if (request.variables?.start) return scoutJson('season-matches-2026-09-19');
			if (request.query?.includes('teams {')) return JSON.stringify({ data: { eventsSearch: [] } });
			return SEASON_LIST;
		case 'EventByCode':
			return scoutJson('event-USAZGIQ');
		case 'TeamSeason':
			return scoutJson('team-2844');
		case 'QuickStats':
			return JSON.stringify({ data: {} });
		case 'TepRecords':
			return TEP_RECORDS;
		case 'EventsOnDate':
			return scoutJson('events-on-2026-11-14');
		default:
			return null;
	}
}

function ftcSeasonWide(url: string): Response | null {
	const { pathname, searchParams } = new URL(url);
	const resource = pathname.replace(/^\/v2\.0\/\d+\//, '');
	const events = fixture<{ events: unknown[] }>(CODE, 'event');
	const teams = fixture<{ teams: { teamNumber: number }[] }>(CODE, 'teams');
	const number = Number(searchParams.get('teamNumber'));
	if (resource === 'events' && !searchParams.has('eventCode')) {
		return Response.json(number && number !== TEAM ? { events: [] } : events);
	}
	if (resource === 'teams' && number) {
		return Response.json({
			...teams,
			teams: teams.teams.filter((team) => team.teamNumber === number)
		});
	}
	if (resource === 'teams' && !searchParams.has('eventCode')) return Response.json(teams);
	return null;
}

function hang(init?: RequestInit): Promise<Response> {
	return new Promise((_, reject) => {
		const signal = init?.signal;
		if (!signal) return;
		if (signal.aborted) reject(signal.reason);
		signal.addEventListener('abort', () => reject(signal.reason), { once: true });
	});
}

function hostOf(url: string): Host | null {
	if (url.startsWith('https://ftc-api.firstinspires.org/')) return 'ftc';
	if (url.startsWith('https://api.ftcscout.org/')) return 'scout';
	if (url.startsWith('https://ftc.nexus/')) return 'nexus';
	if (url.startsWith(REDIS_URL)) return 'redis';
	return null;
}

export interface FakeUpstreams {
	fetch: typeof fetch;
	modes: Modes;
	calls: Record<Host, number>;
	redis: Map<string, string>;
	set(next: Partial<Modes>): void;
}

export function fakeUpstreams(initial: Partial<Modes> = {}): FakeUpstreams {
	const modes: Modes = { ...HEALTHY, ...initial };
	const calls: Record<Host, number> = { ftc: 0, scout: 0, nexus: 0, redis: 0 };
	const redis = new Map<string, string>();
	const ftcFixtures = fixtureFetch();

	function healthy(host: Host, url: string, init?: RequestInit): Promise<Response> | Response {
		if (host === 'ftc') return ftcSeasonWide(url) ?? ftcFixtures.fetch(url, init);
		if (host === 'nexus') {
			return Response.json({ eventKey: '2026usazgiq', dataAsOfTime: Date.now(), matches: [] });
		}
		const body = JSON.parse(String(init?.body ?? '[]')) as unknown;
		if (host === 'scout') {
			const text = scoutBody(body as Parameters<typeof scoutBody>[0]);
			return text === null
				? new Response('unknown query', { status: 400 })
				: new Response(text, { headers: { 'content-type': 'application/json' } });
		}
		const [command, ...args] = body as string[];
		if (command.toLowerCase() === 'mget') {
			return Response.json({ result: args.map((key) => redis.get(key) ?? null) });
		}
		if (command.toLowerCase() === 'set') {
			redis.set(args[0], args[1]);
			return Response.json({ result: 'OK' });
		}
		return Response.json({ result: null });
	}

	const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input instanceof Request ? input.url : input);
		const host = hostOf(url);
		if (!host) throw new TypeError(`unexpected request to ${url}`);
		calls[host] += 1;
		switch (modes[host]) {
			case 'hang':
				return hang(init);
			case 'down':
				throw new TypeError('fetch failed');
			case 'error':
				return new Response('upstream broke', { status: 500 });
			case 'denied':
				return new Response('unauthorized', { status: 401 });
			case 'garbage':
				return new Response('<html>maintenance</html>', {
					status: 200,
					headers: { 'content-type': 'text/html' }
				});
			default:
				return healthy(host, url, init);
		}
	};

	return {
		fetch: fetcher as typeof fetch,
		modes,
		calls,
		redis,
		set(next) {
			Object.assign(modes, next);
		}
	};
}
