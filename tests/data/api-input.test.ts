import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cache } from '#lib/server/cache.ts';

vi.mock('$app/env/private', () => ({
	FTC_USERNAME: 'tester',
	FTC_API_KEY: 'not-a-real-key',
	NEXUS_API_KEY: 'not-a-real-nexus-key',
	KV_REST_API_URL: undefined,
	KV_REST_API_TOKEN: undefined,
	UPSTASH_REDIS_REST_URL: undefined,
	UPSTASH_REDIS_REST_TOKEN: undefined
}));

const { GET: eventRoute } = await import('../../src/routes/api/events/[code]/+server.ts');
const { GET: analysisRoute } =
	await import('../../src/routes/api/events/[code]/analysis/+server.ts');
const { GET: nexusRoute } = await import('../../src/routes/api/nexus/[code]/+server.ts');
const { GET: teamRoute } = await import('../../src/routes/api/teams/[number]/+server.ts');
const { GET: historyRoute } =
	await import('../../src/routes/api/teams/[number]/history/+server.ts');

type Handler = (event: never) => Response | Promise<Response>;

const junkCodes = [
	'',
	'A',
	'..',
	'../teams',
	'USAZGIQ/../../teams',
	'USAZGIQ?eventCode=OTHER',
	'USAZGIQ&page=2',
	'US AZ',
	'USAZ%00',
	'USAZGIQ\n',
	"1'; DROP TABLE events; --",
	'é1',
	'x'.repeat(200)
];

const junkNumbers = [
	'',
	'0',
	'-1',
	'abc',
	'1e3',
	'0x10',
	'12.5',
	'007',
	'100000',
	'99999999999999999999',
	'1 or 1=1',
	'2844/history',
	'2844?x=1',
	'٣٤'
];

let fetcher: ReturnType<typeof vi.fn>;

beforeEach(() => {
	cache.clear();
	fetcher = vi.fn(async () => new Response('should not be asked', { status: 500 }));
	vi.stubGlobal('fetch', fetcher);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

async function expectRefused(handler: Handler, params: Record<string, string>) {
	const response = await handler({ params } as never);
	expect(response.status, JSON.stringify(params)).toBe(404);
	expect(Object.keys((await response.json()) as object)).toEqual(['error']);
	expect(fetcher, JSON.stringify(params)).not.toHaveBeenCalled();
}

describe('routes that take an event code', () => {
	it.each(junkCodes)('refuse %j without asking anyone', async (code) => {
		await expectRefused(eventRoute, { code });
		await expectRefused(analysisRoute, { code });
		await expectRefused(nexusRoute, { code });
	});
});

describe('routes that take a team number', () => {
	it.each(junkNumbers)('refuse %j without asking anyone', async (number) => {
		await expectRefused(teamRoute, { number });
		await expectRefused(historyRoute, { number });
	});
});
