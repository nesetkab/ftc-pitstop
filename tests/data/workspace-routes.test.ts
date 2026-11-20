import { describe, expect, it, vi } from 'vitest';
import { RATE } from '#lib/workspace/api.ts';

vi.mock('$app/env/private', () => ({
	FTC_USERNAME: undefined,
	FTC_API_KEY: undefined,
	NEXUS_API_KEY: undefined,
	KV_REST_API_URL: 'https://example-redis.upstash.io',
	KV_REST_API_TOKEN: 'example-token-123456',
	UPSTASH_REDIS_REST_URL: undefined,
	UPSTASH_REDIS_REST_TOKEN: undefined
}));

vi.mock('@upstash/redis', async () => {
	const { createFakeRedis } = await import('#lib/workspace/fake-redis.ts');
	return {
		Redis: class {
			constructor() {
				return createFakeRedis();
			}
		}
	};
});

const { POST: create } = await import('../../src/routes/api/workspace/+server.ts');
const { GET: load } = await import('../../src/routes/api/workspace/[code]/+server.ts');
const { PUT: write } = await import('../../src/routes/api/workspace/[code]/[doc]/+server.ts');

function json(method: string, path: string, body: unknown, headers: Record<string, string> = {}) {
	return new Request(`http://localhost${path}`, {
		method,
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify(body)
	});
}

function make(address: string, teamNumber = 1) {
	return create({
		request: json('POST', '/api/workspace', { teamNumber }),
		getClientAddress: () => address
	} as never);
}

describe('workspace routes', () => {
	it('create, write and read through the real handlers', async () => {
		const created = await make('203.0.113.7');
		expect(created.status).toBe(201);
		const { code } = (await created.json()) as { code: string };
		const saved = await write({
			request: json('PUT', `/api/workspace/${code}/picklist`, {
				data: { event: null, entries: [{ team: 2844 }] }
			}),
			params: { code, doc: 'picklist' },
			getClientAddress: () => '203.0.113.7'
		} as never);
		expect(saved.status).toBe(200);
		const loaded = await load({
			request: new Request(`http://localhost/api/workspace/${code}`),
			params: { code },
			getClientAddress: () => '203.0.113.7'
		} as never);
		const body = (await loaded.json()) as { docs: { picklist: { data: { entries: unknown[] } } } };
		expect(body.docs.picklist.data.entries).toHaveLength(1);
	});

	it('treats every address in one IPv6 network as one client', async () => {
		for (let i = 0; i < RATE.create.limit; i++) {
			expect((await make(`2001:db8:55:66:${i.toString(16)}::1`)).status).toBe(201);
		}
		expect((await make('2001:db8:55:66:ffff::9')).status).toBe(429);
		expect((await make('2001:db8:55:67::1')).status).toBe(201);
	});

	it('does not let a forged address header spread the limits over many clients', async () => {
		for (let i = 0; i < RATE.create.limit; i++) await make('198.51.100.20');
		const spoofed = await create({
			request: json('POST', '/api/workspace', { teamNumber: 1 }, { 'x-forwarded-for': '10.9.9.9' }),
			getClientAddress: () => '198.51.100.20'
		} as never);
		expect(spoofed.status).toBe(429);
	});

	it('refuses writes from other sites through the real handler', async () => {
		const { code } = (await (await make('203.0.113.50')).json()) as { code: string };
		const answer = await write({
			request: json(
				'PUT',
				`/api/workspace/${code}/picklist`,
				{ data: { event: null, entries: [] } },
				{ origin: 'https://evil.example' }
			),
			params: { code, doc: 'picklist' },
			getClientAddress: () => '203.0.113.50'
		} as never);
		expect(answer.status).toBe(403);
	});
});
