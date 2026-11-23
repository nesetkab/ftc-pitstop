import { beforeEach, describe, expect, it } from 'vitest';
import { createWorkspaceApi, RATE, type WorkspaceApi } from '#lib/workspace/api.ts';
import { CODE_ALPHABET } from '#lib/workspace/code.ts';
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

function put(code: string, doc: string, body: unknown, ip = IP) {
	return api.write(
		json(body, 'PUT', `https://pitstop.test/api/workspace/${code}/${doc}`),
		code,
		doc,
		ip
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
			(
				await api.create(
					new Request('https://x.test', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: '{'
					}),
					IP
				)
			).status
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

	it('limits one address over a whole day, not just an hour', async () => {
		time = Math.floor(time / 86_400_000) * 86_400_000;
		let made = 0;
		for (let hour = 0; hour < 6; hour++) {
			for (let i = 0; i < RATE.create.limit; i++) {
				if ((await api.create(json({ teamNumber: 1 }), IP)).status === 201) made++;
			}
			time += 3_600_000;
		}
		expect(made).toBeLessThanOrEqual(RATE.createDaily.limit);
		expect(made).toBeGreaterThan(RATE.create.limit);
	});

	it('caps how many workspaces the whole site creates in a day', async () => {
		time = Math.floor(time / 86_400_000) * 86_400_000;
		let made = 0;
		for (let i = 0; i < RATE.createAll.limit + 20; i++) {
			const ip = `198.51.${Math.floor(i / 250)}.${i % 250}`;
			if ((await api.create(json({ teamNumber: 1 }), ip)).status === 201) made++;
		}
		expect(made).toBe(RATE.createAll.limit);
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
					new Request('https://x.test', {
						method: 'PUT',
						headers: { 'content-type': 'application/json' },
						body: 'nope'
					}),
					code,
					'checklist',
					IP
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
		time += 601_000;
		expect((await get(code)).status).toBe(200);
	});

	it('counts guesses even when the request claims to be a poll', async () => {
		for (const query of ['?known=', '?known=checklist.1', '?known=picklist.5,boards.9']) {
			for (let i = 0; i < RATE.miss.limit / 3; i++) {
				expect((await get('ZZZZZZ', query)).status).toBe(404);
			}
		}
		expect((await get('ZZZZZZ', '?known=')).status).toBe(429);
		const { code } = await create();
		expect((await get(code, '?known=')).status).toBe(429);
		expect((await get(code, '?known=checklist.1')).status).toBe(429);
	});

	it('does not answer a guess that is over the limit, even when it is right', async () => {
		const { code } = await create();
		await put(code, 'checklist', { data: checklist('secret') });
		for (let i = 0; i < RATE.miss.limit; i++) await get('ZZZZZZ', '?known=');
		const blocked = await get(code, '?known=checklist.1');
		expect(blocked.status).toBe(429);
		expect(JSON.stringify(await blocked.json())).not.toContain('secret');
	});

	it('keeps polling for people who can prove they have the workspace', async () => {
		const { code } = await create();
		const saved = (await (await put(code, 'checklist', { data: checklist('One') })).json()) as {
			updatedAt: number;
		};
		for (let i = 0; i < RATE.miss.limit; i++) await get('ZZZZZZ');
		expect((await get('ZZZZZZ')).status).toBe(429);
		const poll = await get(code, `?known=checklist.${saved.updatedAt}`);
		expect(poll.status).toBe(200);
		expect(await poll.json()).toEqual({
			meta: expect.objectContaining({ code }),
			docs: {},
			rev: expect.any(String),
			key: expect.any(String)
		});
		expect((await get(code, `?known=checklist.${saved.updatedAt + 1}`)).status).toBe(429);
	});

	it('lets people who opened the workspace keep polling with its key, and nobody else', async () => {
		const { code } = await create();
		const { key } = (await (await get(code)).json()) as { key: string };
		for (let i = 0; i < RATE.miss.limit; i++) await get('ZZZZZZ');
		expect((await get(code, `?key=${key}`)).status).toBe(200);
		expect((await get(code, `?key=${'0'.repeat(32)}`)).status).toBe(429);
		expect((await get('ZZZZZZ', `?key=${key}`)).status).toBe(429);
	});

	it('does not charge people who open a workspace they have the code for', async () => {
		const { code } = await create();
		for (let i = 0; i < RATE.miss.limit * 3; i++) expect((await get(code)).status).toBe(200);
		for (let i = 0; i < RATE.miss.limit; i++) expect((await get('ZZZZZZ')).status).toBe(404);
		expect((await get(code)).status).toBe(429);
	});

	it('never lets the bookkeeping field out', async () => {
		const { code } = await create();
		const body = (await (await get(code)).json()) as Record<string, unknown>;
		expect(Object.keys(body).sort()).toEqual(['docs', 'key', 'meta', 'rev']);
	});

	it('applies the guessing limit to writes too', async () => {
		const { code } = await create();
		for (let i = 0; i < RATE.miss.limit; i++) {
			const guess = `ZZZZZ${CODE_ALPHABET[i % CODE_ALPHABET.length]}`;
			expect((await put(guess, 'checklist', { data: {} })).status).toBe(404);
		}
		const blocked = await put(code, 'checklist', { data: checklist('late') });
		expect(blocked.status).toBe(429);
		expect(await redis.get(`pitstop:ws:${code}:checklist`)).toBeNull();
		expect(
			(await put(code, 'checklist', { data: checklist('other') }, '198.51.100.7')).status
		).toBe(200);
	});

	it('does not charge writers for writes to their own workspace', async () => {
		const { code } = await create();
		for (let i = 0; i < RATE.miss.limit - 1; i++) {
			expect((await put('ZZZZZZ', 'checklist', { data: checklist('x') })).status).toBe(404);
		}
		for (let i = 0; i < 60; i++) {
			expect((await put(code, 'checklist', { data: checklist(`${i}`) })).status).toBe(200);
		}
		expect((await put('ZZZZZZ', 'checklist', { data: checklist('x') })).status).toBe(404);
		expect((await put('ZZZZZZ', 'checklist', { data: checklist('x') })).status).toBe(429);
	});

	it('gives back the charge when the workspace is busy, not guessed', async () => {
		const { code } = await create();
		for (let i = 0; i < RATE.write.limit; i++)
			await put(code, 'checklist', { data: checklist('a') });
		for (let i = 0; i < RATE.miss.limit * 2; i++) {
			expect((await put(code, 'checklist', { data: checklist('b') })).status).toBe(429);
		}
		time += 61_000;
		expect((await put(code, 'checklist', { data: checklist('c') })).status).toBe(200);
		expect((await get('ZZZZZZ')).status).toBe(404);
	});

	it('does not look at the body of a request that is not JSON', async () => {
		const { code } = await create();
		const plain = new Request(`https://pitstop.test/api/workspace/${code}/checklist`, {
			method: 'PUT',
			headers: { 'content-type': 'text/plain' },
			body: JSON.stringify({ data: checklist('x') })
		});
		expect((await api.write(plain, code, 'checklist', IP)).status).toBe(415);
		const bare = new Request('https://pitstop.test/api/workspace', {
			method: 'POST',
			body: new Blob([JSON.stringify({ teamNumber: 1 })])
		});
		expect(bare.headers.get('content-type')).toBeNull();
		expect((await api.create(bare, IP)).status).toBe(415);
		expect(redis.keys().filter((key) => key.includes(':checklist'))).toEqual([]);
	});

	it('refuses requests from other sites', async () => {
		const { code } = await create();
		const from = (origin: string, method: 'POST' | 'PUT', path: string, body: unknown) =>
			new Request(`https://pitstop.test${path}`, {
				method,
				headers: { 'content-type': 'application/json', origin },
				body: JSON.stringify(body)
			});
		const foreign = 'https://evil.example';
		expect(
			(await api.create(from(foreign, 'POST', '/api/workspace', { teamNumber: 1 }), IP)).status
		).toBe(403);
		expect(
			(await api.create(from('null', 'POST', '/api/workspace', { teamNumber: 1 }), IP)).status
		).toBe(403);
		const write = from(foreign, 'PUT', `/api/workspace/${code}/checklist`, {
			data: checklist('x')
		});
		expect((await api.write(write, code, 'checklist', IP)).status).toBe(403);
		expect(await redis.get(`pitstop:ws:${code}:checklist`)).toBeNull();
		const own = from('https://pitstop.test', 'PUT', `/api/workspace/${code}/checklist`, {
			data: checklist('x')
		});
		expect((await api.write(own, code, 'checklist', IP)).status).toBe(200);
	});

	it('compares the site, not the way the address reached the function', async () => {
		const { code } = await create();
		const put = (origin: string, extra: Record<string, string> = {}, url = 'http://pitstop.test') =>
			api.write(
				new Request(`${url}/api/workspace/${code}/checklist`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json', origin, ...extra },
					body: JSON.stringify({ data: checklist('x') })
				}),
				code,
				'checklist',
				IP
			);
		expect((await put('https://pitstop.test')).status).toBe(200);
		expect((await put('https://pitstop.test:8443')).status).toBe(403);
		expect((await put('https://evil.pitstop.test')).status).toBe(403);
		expect((await put('https://pitstop.test.evil.example')).status).toBe(403);
		expect((await put('https://www.pitstop.test')).status).toBe(403);
		expect(
			(await put('https://www.pitstop.test', { 'x-forwarded-host': 'www.pitstop.test' })).status
		).toBe(200);
		expect((await put('javascript:alert(1)')).status).toBe(403);
		expect((await put('')).status).toBe(403);
	});

	it('stops reading a body that is bigger than any document can be', async () => {
		const { code } = await create();
		let pulls = 0;
		let cancelled = false;
		const flood = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulls++;
				controller.enqueue(new TextEncoder().encode('x'.repeat(65_536)));
			},
			cancel() {
				cancelled = true;
			}
		});
		const request = new Request(`https://pitstop.test/api/workspace/${code}/checklist`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: flood,
			duplex: 'half'
		} as RequestInit);
		expect((await api.write(request, code, 'checklist', IP)).status).toBe(413);
		expect(cancelled).toBe(true);
		expect(pulls).toBeLessThan(40);
	});

	it('refuses bodies that announce a size over the limit without reading them', async () => {
		const { code } = await create();
		const request = new Request(`https://pitstop.test/api/workspace/${code}/checklist`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json', 'content-length': '50000000' },
			body: '{}'
		});
		expect((await api.write(request, code, 'checklist', IP)).status).toBe(413);
		const small = new Request('https://pitstop.test/api/workspace', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'content-length': '5000' },
			body: '{"teamNumber":1}'
		});
		expect((await api.create(small, IP)).status).toBe(413);
	});

	it('counts the size of a body in characters the way the store does', async () => {
		const { code } = await create();
		const text = '日本語'.repeat(10_000);
		const wide = { match: text.slice(0, 16), items: [], history: [] };
		expect((await put(code, 'checklist', { data: wide })).status).toBe(200);
		const bigNote = { data: { event: null, entries: [{ team: 1, note: text }] } };
		expect((await put(code, 'picklist', bigNote)).status).toBe(400);
		expect(
			(await put(code, 'picklist', { data: { event: null, entries: [] }, pad: text })).status
		).toBe(200);
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
			if (doc) return api.write(request, code, doc, IP);
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
