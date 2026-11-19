import { beforeEach, describe, expect, it } from 'vitest';
import { createWorkspaceApi, RATE, type WorkspaceApi } from '#lib/workspace/api.ts';
import { createFakeRedis, type FakeRedis } from '#lib/workspace/fake-redis.ts';
import { createLimiter } from '#lib/workspace/limit.ts';
import { createRedisStore } from '#lib/workspace/redis-store.ts';
import { createRemoteStore } from '#lib/workspace/remote-store.ts';
import type { Checklist } from '#lib/workspace/schemas.ts';

let time: number;
let redis: FakeRedis;
let api: WorkspaceApi;

const IP = '203.0.113.9';

function checklist(text: string): Checklist {
	return { match: 'Q1', items: [{ id: 'a', text, by: null, at: null }], history: [] };
}

function json(body: unknown, method = 'POST', url = 'https://pitstop.test/api/workspace') {
	return new Request(url, {
		method,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

async function create(teamNumber: number | null = 14624) {
	const response = await api.create(json({ teamNumber }), IP);
	return (await response.json()) as { code: string };
}

function put(code: string, doc: string, body: unknown) {
	return api.write(
		json(body, 'PUT', `https://pitstop.test/api/workspace/${code}/${doc}`),
		code,
		doc
	);
}

function get(code: string, query = '') {
	return api.load(new Request(`https://pitstop.test/api/workspace/${code}${query}`), code, IP);
}

beforeEach(() => {
	time = 1_700_000_000_000;
	redis = createFakeRedis(() => time);
	api = createWorkspaceApi(
		createRedisStore(redis, { now: () => time }),
		createLimiter(redis, { now: () => time })
	);
});

describe('workspace api', () => {
	it('creates a workspace', async () => {
		const response = await api.create(json({ teamNumber: 14624 }), IP);
		expect(response.status).toBe(201);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toMatchObject({ teamNumber: 14624 });
	});

	it('rejects a team number that is not a number', async () => {
		expect((await api.create(json({ teamNumber: 'abc' }), IP)).status).toBe(400);
		expect((await api.create(json({ teamNumber: 0 }), IP)).status).toBe(400);
		expect((await api.create(json({}), IP)).status).toBe(400);
		expect(
			(await api.create(new Request('https://x.test', { method: 'POST', body: '{' }), IP)).status
		).toBe(400);
	});

	it('limits how many workspaces one address can create', async () => {
		for (let i = 0; i < RATE.create.limit; i++) {
			expect((await api.create(json({ teamNumber: 1 }), IP)).status).toBe(201);
		}
		const blocked = await api.create(json({ teamNumber: 1 }), IP);
		expect(blocked.status).toBe(429);
		expect(blocked.headers.get('retry-after')).toBe('60');
		expect((await api.create(json({ teamNumber: 1 }), '198.51.100.1')).status).toBe(201);
	});

	it('loads a snapshot and answers 404 for unknown or malformed codes', async () => {
		const { code } = await create();
		const found = await get(code);
		expect(found.status).toBe(200);
		expect(await found.json()).toMatchObject({ meta: { code, teamNumber: 14624 }, docs: {} });
		expect((await get('ZZZZZZ')).status).toBe(404);
		expect((await get('abc')).status).toBe(404);
		expect((await get('ABCDE0')).status).toBe(404);
	});

	it('writes a document and returns its version', async () => {
		const { code } = await create();
		const response = await put(code, 'checklist', { data: checklist('One'), base: null });
		expect(response.status).toBe(200);
		const { updatedAt } = (await response.json()) as { updatedAt: number };
		expect(updatedAt).toBe(time);
		const snapshot = (await (await get(code)).json()) as {
			docs: { checklist: { updatedAt: number } };
		};
		expect(snapshot.docs.checklist.updatedAt).toBe(updatedAt);
	});

	it('answers 409 with the current document when the base is stale', async () => {
		const { code } = await create();
		const first = (await (
			await put(code, 'checklist', { data: checklist('One'), base: null })
		).json()) as { updatedAt: number };
		time += 10;
		await put(code, 'checklist', { data: checklist('Two'), base: first.updatedAt });
		const stale = await put(code, 'checklist', { data: checklist('Three'), base: first.updatedAt });
		expect(stale.status).toBe(409);
		const body = (await stale.json()) as { data: Checklist };
		expect(body.data.items[0].text).toBe('Two');
	});

	it('overwrites when the request has no base', async () => {
		const { code } = await create();
		await put(code, 'checklist', { data: checklist('One') });
		const second = await put(code, 'checklist', { data: checklist('Two') });
		expect(second.status).toBe(200);
	});

	it('rejects unknown documents, unknown workspaces and invalid data', async () => {
		const { code } = await create();
		expect((await put(code, 'secrets', { data: {} })).status).toBe(404);
		expect((await put('ZZZZZZ', 'checklist', { data: checklist('x') })).status).toBe(404);
		expect((await put('nope', 'checklist', { data: checklist('x') })).status).toBe(404);
		expect((await put(code, 'checklist', { data: { items: 'no' } })).status).toBe(400);
		expect((await put(code, 'checklist', { nothing: true })).status).toBe(400);
		expect(
			(
				await api.write(
					new Request('https://x.test', { method: 'PUT', body: 'nope' }),
					code,
					'checklist'
				)
			).status
		).toBe(400);
	});

	it('refuses oversized bodies', async () => {
		const { code } = await create();
		const body = { data: { match: 'x'.repeat(100_000), items: [], history: [] } };
		expect((await put(code, 'checklist', body)).status).toBe(413);
	});

	it('strips fields it does not know before saving', async () => {
		const { code } = await create();
		await put(code, 'checklist', {
			data: { ...checklist('One'), admin: true, items: [{ id: 'a', text: 'One', extra: 1 }] }
		});
		const raw = JSON.parse((await redis.get(`pitstop:ws:${code}:checklist`)) as string);
		expect(raw.data.admin).toBeUndefined();
		expect(raw.data.items[0]).toEqual({ id: 'a', text: 'One', by: null, at: null });
	});

	it('limits writes per workspace, not per address', async () => {
		const { code } = await create();
		const other = await create();
		for (let i = 0; i < RATE.write.limit; i++) {
			expect((await put(code, 'checklist', { data: checklist(`${i}`) })).status).toBe(200);
		}
		expect((await put(code, 'checklist', { data: checklist('late') })).status).toBe(429);
		expect((await put(other.code, 'checklist', { data: checklist('fine') })).status).toBe(200);
		time += 61_000;
		expect((await put(code, 'checklist', { data: checklist('again') })).status).toBe(200);
	});

	it('slows down an address that keeps guessing codes', async () => {
		for (let i = 0; i < RATE.miss.limit; i++) expect((await get('ZZZZZZ')).status).toBe(404);
		expect((await get('ZZZZZZ')).status).toBe(429);
		const { code } = await create();
		expect((await get(code)).status).toBe(429);
		expect((await get(code, '?known=checklist.1')).status).toBe(200);
	});

	it('never caches', async () => {
		const { code } = await create();
		for (const response of [await get(code), await get('ZZZZZZ')]) {
			expect(response.headers.get('cache-control')).toBe('no-store');
		}
	});

	it('answers 503 when storage fails', async () => {
		const broken = createWorkspaceApi(
			createRedisStore({
				...redis,
				mget: async () => {
					throw new Error('connection reset');
				}
			}),
			createLimiter(redis)
		);
		const response = await broken.load(
			new Request('https://x.test/api/workspace/ABCDEF'),
			'ABCDEF',
			IP
		);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'Workspaces are unavailable right now' });
	});
});

describe('remote store through the api', () => {
	function remote() {
		const route = async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = new URL(String(input), 'https://pitstop.test');
			const [, , , code, doc] = url.pathname.split('/');
			const request = new Request(url, init);
			if (!code) return api.create(request, IP);
			if (doc) return api.write(request, code, doc);
			return api.load(request, code, IP);
		};
		return createRemoteStore({ fetch: route as typeof fetch });
	}

	it('creates, writes and reads a workspace', async () => {
		const store = remote();
		const meta = await store.create({ teamNumber: 14624 });
		const written = await store.write(meta.code, 'checklist', checklist('One'), null);
		if (!written.ok) throw new Error('write failed');
		const snapshot = await store.load(meta.code);
		expect(snapshot?.meta).toEqual(meta);
		expect(snapshot?.docs.checklist).toEqual(written.stamped);
	});

	it('reports a conflict with the stored document', async () => {
		const store = remote();
		const { code } = await store.create({ teamNumber: 1 });
		const first = await store.write(code, 'checklist', checklist('One'), null);
		if (!first.ok) throw new Error('write failed');
		await store.write(code, 'checklist', checklist('Two'), first.stamped.updatedAt);
		const stale = await store.write(code, 'checklist', checklist('Three'), first.stamped.updatedAt);
		expect(stale.ok).toBe(false);
		if (!stale.ok) expect(stale.current.data.items[0].text).toBe('Two');
	});

	it('returns null for an unknown code and filters known versions', async () => {
		const store = remote();
		expect(await store.load('ZZZZZZ')).toBeNull();
		const { code } = await store.create({ teamNumber: 1 });
		const first = await store.write(code, 'checklist', checklist('One'), null);
		if (!first.ok) throw new Error('write failed');
		const same = await store.load(code, { known: { checklist: first.stamped.updatedAt } });
		expect(same?.docs).toEqual({});
	});

	it('maps failures to workspace errors', async () => {
		const failing = (status: number) =>
			createRemoteStore({
				fetch: (async () => new Response('{}', { status })) as typeof fetch
			});
		await expect(failing(429).create({ teamNumber: 1 })).rejects.toMatchObject({
			code: 'rate-limited'
		});
		await expect(failing(503).load('ABCDEF')).rejects.toMatchObject({ code: 'unavailable' });
		await expect(failing(413).write('ABCDEF', 'checklist', checklist('x'))).rejects.toMatchObject({
			code: 'too-large'
		});
		const offline = createRemoteStore({
			fetch: (async () => {
				throw new TypeError('network down');
			}) as typeof fetch
		});
		await expect(offline.load('ABCDEF')).rejects.toMatchObject({ code: 'unavailable' });
	});

	it('rejects answers that do not look like workspaces', async () => {
		const odd = createRemoteStore({
			fetch: (async () => Response.json({ hello: 'world' })) as typeof fetch
		});
		await expect(odd.load('ABCDEF')).rejects.toMatchObject({ code: 'unavailable' });
		await expect(odd.create({ teamNumber: 1 })).rejects.toMatchObject({ code: 'unavailable' });
		await expect(odd.write('ABCDEF', 'checklist', checklist('x'))).rejects.toMatchObject({
			code: 'unavailable'
		});
	});
});
