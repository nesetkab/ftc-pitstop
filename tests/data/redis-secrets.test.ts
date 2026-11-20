import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureFetch } from './helpers.ts';

const REDIS_URL = 'https://eu1-secret-host-7788.upstash.io';
const REDIS_TOKEN = 'AXXXredis-secret-token-5521';
const COMMAND = '["SET","pitstop:ws:QWERTY:picklist","private pick list"]';

const upstash = vi.hoisted(() => ({
	fail: (message: string): Error => {
		const error = new Error(message);
		error.name = 'UpstashError';
		return error;
	}
}));

vi.mock('$app/env/private', () => ({
	FTC_USERNAME: 'pitstop-secret-user',
	FTC_API_KEY: 'F7C2A9E1-SECRET-KEY-0042',
	NEXUS_API_KEY: undefined,
	KV_REST_API_URL: 'https://eu1-secret-host-7788.upstash.io',
	KV_REST_API_TOKEN: 'AXXXredis-secret-token-5521',
	UPSTASH_REDIS_REST_URL: undefined,
	UPSTASH_REDIS_REST_TOKEN: undefined
}));

vi.mock('@upstash/redis', () => {
	const broken = () => {
		throw upstash.fail(
			`Command failed: WRONGPASS Bearer AXXXredis-secret-token-5521 at https://eu1-secret-host-7788.upstash.io, command was: ${'["SET","pitstop:ws:QWERTY:picklist","private pick list"]'}`
		);
	};
	class Redis {
		get = vi.fn(async () => broken());
		mget = vi.fn(async () => broken());
		set = vi.fn(async () => broken());
		incr = vi.fn(async () => broken());
		decr = vi.fn(async () => broken());
		expire = vi.fn(async () => broken());
	}
	return { Redis };
});

const { POST: createRoute } = await import('../../src/routes/api/workspace/+server.ts');
const { GET: loadRoute } = await import('../../src/routes/api/workspace/[code]/+server.ts');
const { PUT: writeRoute } = await import('../../src/routes/api/workspace/[code]/[doc]/+server.ts');
const { GET: eventRoute } = await import('../../src/routes/api/events/[code]/+server.ts');
const { describeError } = await import('#lib/server/errors.ts');

const secrets = [REDIS_URL, REDIS_TOKEN, 'eu1-secret-host-7788', 'private pick list', 'QWERTY'];

let logs: string[] = [];

function json(path: string, method: string, body: unknown) {
	return new Request(`http://localhost${path}`, {
		method,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function expectClean(...texts: string[]) {
	for (const text of texts) for (const secret of secrets) expect(text).not.toContain(secret);
}

beforeEach(() => {
	logs = [];
	for (const method of ['log', 'warn', 'error'] as const) {
		vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
			logs.push(args.map(String).join(' '));
		});
	}
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('the Redis credentials stay on the server', () => {
	it('keeps them out of workspace answers and logs when Redis fails', async () => {
		const answers = [
			await createRoute({
				request: json('/api/workspace', 'POST', { teamNumber: 14624 }),
				getClientAddress: () => '203.0.113.7'
			} as never),
			await loadRoute({
				request: new Request('http://localhost/api/workspace/QWERTY'),
				params: { code: 'QWERTY' },
				getClientAddress: () => '203.0.113.7'
			} as never),
			await writeRoute({
				request: json('/api/workspace/QWERTY/picklist', 'PUT', {
					data: { event: null, entries: [] }
				}),
				params: { code: 'QWERTY', doc: 'picklist' },
				getClientAddress: () => '203.0.113.7'
			} as never)
		];
		for (const answer of answers) {
			expect(answer.status).toBe(503);
			expect(await answer.json()).toEqual({ error: 'Workspaces are unavailable right now' });
			expectClean(JSON.stringify([...answer.headers.entries()]));
		}
		expect(logs.length).toBeGreaterThan(0);
		expectClean(...logs);
		for (const line of logs) expect(line).not.toContain('command was');
	});

	it('keeps them out of cache logs when the shared cache fails', async () => {
		vi.stubGlobal('fetch', fixtureFetch().fetch);
		const answer = await eventRoute({ params: { code: 'USAZGIQ' } } as never);
		expect(answer.status).toBe(200);
		expectClean(await answer.text(), ...logs);
		expect(logs.some((line) => line.includes('cache refresh failed'))).toBe(true);
		for (const line of logs) expect(line).not.toContain('command was');
	});
});

describe('describeError', () => {
	it('drops the command the Redis client repeats back', () => {
		const text = describeError(upstash.fail(`WRONGPASS nope, command was: ${COMMAND}`));
		expect(text).toBe('UpstashError WRONGPASS nope');
	});

	it('hides addresses and caps the length', () => {
		const text = describeError(
			new Error(`could not reach https://example.com/path?token=abc ${'x'.repeat(500)}`)
		);
		expect(text).toContain('[url]');
		expect(text).not.toContain('example.com');
		expect(text.length).toBeLessThanOrEqual(220);
	});

	it('removes the configured credentials wherever they appear', () => {
		const text = describeError(new Error(`rejected ${REDIS_TOKEN} for ${REDIS_URL}/x`));
		expect(text).toBe('Error rejected [redacted] for [redacted]/x');
		const split = describeError(new Error(`${'y'.repeat(190)}${REDIS_TOKEN}`));
		expect(split).not.toContain('AXXX');
	});

	it('copes with values that are not errors', () => {
		expect(describeError('boom')).toBe('unknown error');
		expect(describeError({ message: REDIS_TOKEN })).toBe('unknown error');
		expect(describeError(null)).toBe('unknown error');
	});
});
