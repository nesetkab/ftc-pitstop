import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureFetch } from './helpers.ts';

const USERNAME = 'pitstop-secret-user';
const KEY = 'F7C2A9E1-SECRET-KEY-0042';
const NEXUS_KEY = 'NEXUS-SECRET-9911';

vi.mock('$app/env/private', () => ({
	FTC_USERNAME: 'pitstop-secret-user',
	FTC_API_KEY: 'F7C2A9E1-SECRET-KEY-0042',
	NEXUS_API_KEY: 'NEXUS-SECRET-9911',
	KV_REST_API_URL: undefined,
	KV_REST_API_TOKEN: undefined,
	UPSTASH_REDIS_REST_URL: undefined,
	UPSTASH_REDIS_REST_TOKEN: undefined
}));

const { GET: eventRoute } = await import('../../src/routes/api/events/[code]/+server.ts');
const { GET: eventsRoute } = await import('../../src/routes/api/events/+server.ts');
const { GET: teamRoute } = await import('../../src/routes/api/teams/[number]/+server.ts');
const { GET: searchRoute } = await import('../../src/routes/api/search/+server.ts');
const { GET: todayRoute } = await import('../../src/routes/api/today/+server.ts');
const { GET: nexusRoute } = await import('../../src/routes/api/nexus/[code]/+server.ts');
const { GET: analysisRoute } =
	await import('../../src/routes/api/events/[code]/analysis/+server.ts');
const { GET: ratingsRoute } = await import('../../src/routes/api/ratings/+server.ts');
const { GET: historyRoute } =
	await import('../../src/routes/api/teams/[number]/history/+server.ts');
const { load: eventLayout } = await import('../../src/routes/(app)/events/[code]/+layout.server.ts');
const { load: teamPage } = await import('../../src/routes/(app)/teams/[number]/+page.server.ts');
const { load: pitLayout } = await import('../../src/routes/(bare)/[team=team]/+layout.server.ts');
const { cache } = await import('#lib/server/cache.ts');
const { ftc } = await import('#lib/server/ftc/index.ts');
const { scoutClient } = await import('#lib/server/ftcscout.ts');
const { nexus } = await import('#lib/server/nexus.ts');

const basic = btoa(`${USERNAME}:${KEY}`);
const secrets = [KEY, basic, `${USERNAME}:${KEY}`, NEXUS_KEY, KEY.toLowerCase()];

function leaky(mode: number) {
	return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const headers = new Headers(init?.headers);
		const echo = `${headers.get('authorization')} ${headers.get('nexus-api-key')} ${KEY} ${NEXUS_KEY}`;
		if (mode === 0)
			return new Response(`server error ${echo}`, { status: 500, headers: { 'x-echo': echo } });
		if (mode === 1)
			throw new Error(`connect ECONNREFUSED while sending ${echo} to ${String(input)}`);
		if (mode === 2)
			return new Response(`unauthorized ${echo}`, { status: 401, statusText: `bad ${KEY}` });
		if (mode === 3) return Response.json({ events: `not a list ${echo}`, data: `bad ${echo}` });
		return new Response(`<html>${echo}</html>`, {
			status: 200,
			headers: { 'content-type': 'text/html' }
		});
	});
}

type Handler = (event: never) => Response | Promise<Response>;

async function drive<T>(task: Promise<T>): Promise<T> {
	let done = false;
	task.then(
		() => (done = true),
		() => (done = true)
	);
	while (!done) await vi.advanceTimersByTimeAsync(1000);
	return task;
}

async function call(handler: Handler, path: string, params: Record<string, string> = {}) {
	const url = new URL(`http://localhost${path}`);
	const response = await drive(
		Promise.resolve(handler({ params, url, request: new Request(url) } as never))
	);
	return {
		status: response.status,
		text: await response.text(),
		headers: [...response.headers.entries()].join(' ')
	};
}

async function settle(task: () => unknown): Promise<string> {
	try {
		return JSON.stringify(await drive(Promise.resolve(task())));
	} catch (caught) {
		return `${JSON.stringify(caught)} ${String(caught)} ${(caught as Error).stack ?? ''}`;
	}
}

function expectClean(...texts: string[]) {
	for (const text of texts) for (const secret of secrets) expect(text).not.toContain(secret);
}

let logs: string[] = [];

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	cache.clear();
	for (const breaker of [ftc.breaker, scoutClient.breaker, nexus.breaker]) breaker.success();
	logs = [];
	for (const method of ['log', 'warn', 'error'] as const) {
		vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
			logs.push(args.map(String).join(' '));
		});
	}
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('the FTC key stays on the server', () => {
	it.each([0, 1, 2, 3, 4])(
		'never leaks through any route when upstream misbehaves (mode %i)',
		async (mode) => {
			vi.stubGlobal('fetch', leaky(mode));
			const results = [
				await call(eventRoute, `/api/events/LEAK${mode}`, { code: `LEAK${mode}` }),
				await call(eventsRoute, '/api/events'),
				await call(teamRoute, '/api/teams/2844', { number: '2844' }),
				await call(searchRoute, '/api/search?q=valley'),
				await call(todayRoute, '/api/today'),
				await call(nexusRoute, `/api/nexus/LEAK${mode}`, { code: `LEAK${mode}` }),
				await call(analysisRoute, `/api/events/LEAK${mode}/analysis`, { code: `LEAK${mode}` }),
				await call(ratingsRoute, '/api/ratings'),
				await call(historyRoute, '/api/teams/2844/history', { number: '2844' })
			];
			for (const result of results) {
				expect(result.status).toBeGreaterThanOrEqual(400);
				expect(JSON.parse(result.text).error).toMatch(/^[A-Z][a-z ]+$/);
				expectClean(result.text, result.headers);
			}
			expectClean(...logs);
		}
	);

	it.each([0, 1, 2, 3, 4])(
		'never leaks through page loads when upstream misbehaves (mode %i)',
		async (mode) => {
			vi.stubGlobal('fetch', leaky(mode));
			const outcomes = [
				await settle(() =>
					eventLayout({
						params: { code: `LEAK${mode}` },
						url: new URL(`http://localhost/events/LEAK${mode}`),
						depends: () => {},
						untrack: (fn: () => unknown) => fn()
					} as never)
				),
				await settle(() =>
					teamPage({ params: { number: '2844' }, setHeaders: () => {} } as never)
				),
				await settle(() =>
					pitLayout({ params: { team: 2844 }, url: new URL('http://localhost/2844') } as never)
				),
				await settle(() =>
					pitLayout({
						params: { team: 2844 },
						url: new URL(`http://localhost/2844?event=LEAK${mode}`)
					} as never)
				)
			];
			for (const outcome of outcomes) expectClean(outcome);
			expectClean(...logs);
		}
	);

	it('never leaks through client errors', async () => {
		for (const mode of [0, 1, 2, 3, 4]) {
			vi.stubGlobal('fetch', leaky(mode));
			const error = await drive(ftc.request('events?eventCode=LEAK')).then(
				() => null,
				(caught: unknown) => caught
			);
			if (mode === 3 || mode === 4) {
				const schemas = await import('#lib/server/ftc/schemas.ts');
				const shaped = await drive(
					ftc.get('events?eventCode=LEAK', schemas.ftcEventsResponse)
				).then(
					() => null,
					(caught: unknown) => caught
				);
				expect(shaped).toBeInstanceOf(Error);
				expectClean(String(shaped), JSON.stringify(shaped), (shaped as Error).stack ?? '');
				continue;
			}
			expect(error).toBeInstanceOf(Error);
			expectClean(
				String(error),
				JSON.stringify(error),
				(error as Error).stack ?? '',
				JSON.stringify(Object.entries(error as object))
			);
		}
		expectClean(...logs);
	});

	it('serves real data without the key', async () => {
		vi.stubGlobal('fetch', fixtureFetch().fetch);
		const result = await call(eventRoute, '/api/events/USAZGIQ', { code: 'USAZGIQ' });
		expect(result.status).toBe(200);
		expect(JSON.parse(result.text).event.code).toBe('USAZGIQ');
		expectClean(result.text, result.headers, ...logs);
	});
});
