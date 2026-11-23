import { beforeEach, describe, expect, it } from 'vitest';
import { createWorkspaceApi, RATE, type WorkspaceApi } from '#lib/workspace/api.ts';
import { createFakeRedis, type FakeRedis } from '#lib/workspace/fake-redis.ts';
import { createLimiter } from '#lib/workspace/limit.ts';
import { encodeLoadOptions } from '#lib/workspace/query.ts';
import { createRedisStore } from '#lib/workspace/redis-store.ts';
import type { LoadOptions } from '#lib/workspace/types.ts';

const IP = '203.0.113.40';
const PICKS = { event: null, entries: [{ team: 2844 }] };

type Body = { docs: Record<string, { updatedAt: number }>; rev: string; key: string };

let clock: { now: number };
let redis: FakeRedis;

function instance(): WorkspaceApi {
	const now = () => clock.now;
	return createWorkspaceApi(createRedisStore(redis, { now }), createLimiter(redis, { now }));
}

async function commands(task: () => Promise<unknown>): Promise<string[]> {
	const before = redis.calls.length;
	await task();
	return redis.calls.slice(before);
}

async function create(api: WorkspaceApi): Promise<string> {
	const response = await api.create(
		new Request('https://pitstop.test/api/workspace', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ teamNumber: 14624 })
		}),
		IP
	);
	return ((await response.json()) as { code: string }).code;
}

function write(api: WorkspaceApi, code: string, data: unknown = PICKS) {
	return api.write(
		new Request(`https://pitstop.test/api/workspace/${code}/picklist`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ data })
		}),
		code,
		'picklist',
		IP
	);
}

async function load(api: WorkspaceApi, code: string, options: LoadOptions = {}) {
	const response = await api.load(
		new Request(`https://pitstop.test/api/workspace/${code}${encodeLoadOptions(options)}`),
		code,
		IP
	);
	return { status: response.status, body: (await response.json()) as Body };
}

async function opened(api: WorkspaceApi, code: string): Promise<LoadOptions> {
	const { body } = await load(api, code);
	const known = Object.fromEntries(
		Object.entries(body.docs).map(([name, doc]) => [name, doc.updatedAt])
	);
	return { known, rev: body.rev, key: body.key };
}

beforeEach(() => {
	clock = { now: 1_795_000_000_000 };
	redis = createFakeRedis(() => clock.now);
});

describe('redis commands for a workspace poll', () => {
	it('costs nothing on a warm instance and one small read once the cache is old', async () => {
		const api = instance();
		const code = await create(api);
		await write(api, code);
		const poll = await opened(api, code);
		expect(await commands(() => load(api, code, poll))).toEqual([]);
		clock.now += 5_000;
		expect(await commands(() => load(api, code, poll))).toEqual(['get']);
		expect(await commands(() => load(api, code, poll))).toEqual([]);
	});

	it('costs the same for a workspace nothing was saved in yet', async () => {
		const api = instance();
		const code = await create(api);
		const poll = await opened(api, code);
		expect(poll.known).toEqual({});
		expect(await commands(() => load(api, code, poll))).toEqual([]);
		clock.now += 5_000;
		expect(await commands(() => load(api, code, poll))).toEqual(['get']);
	});

	it('never touches the guess limiter for a workspace the poller already opened', async () => {
		const api = instance();
		const code = await create(api);
		const poll = await opened(api, code);
		for (let i = 0; i < RATE.miss.limit; i++) await load(api, 'ZZZZZZ');
		for (let i = 0; i < 40; i++) {
			clock.now += 5_000;
			if (i % 10 === 0) await write(instance(), code, { event: null, entries: [{ team: i + 1 }] });
			const { status } = await load(api, code, poll);
			expect(status).toBe(200);
		}
		const before = redis.calls.length;
		clock.now += 5_000;
		await load(api, code, poll);
		expect(redis.calls.slice(before)).toEqual(['get']);
	});

	it('opens a workspace in one batch plus one limiter read', async () => {
		const code = await create(instance());
		await write(instance(), code);
		expect(await commands(() => load(instance(), code))).toEqual(['mget', 'get']);
	});

	it('charges a guess only for codes that do not exist', async () => {
		const api = instance();
		expect(await commands(() => load(api, 'ZZZZZZ', { rev: 'a'.repeat(32) }))).toEqual([
			'get',
			'incr',
			'expire'
		]);
		expect(await commands(() => load(api, 'ZZZZZZ'))).toEqual(['mget', 'incr']);
	});

	it('fetches documents only when another device changed something', async () => {
		const reader = instance();
		const writer = instance();
		const code = await create(writer);
		await write(writer, code);
		const poll = await opened(reader, code);
		clock.now += 5_000;
		await write(writer, code, { event: null, entries: [{ team: 7 }] });
		const changed = await commands(async () => {
			const { body } = await load(reader, code, poll);
			expect(body.docs.picklist).toBeDefined();
		});
		expect(changed).toEqual(['get', 'mget']);
	});

	it('serves a second viewer on the same instance from memory after a change', async () => {
		const reader = instance();
		const writer = instance();
		const code = await create(writer);
		await write(writer, code);
		const first = await opened(reader, code);
		const second = await opened(reader, code);
		clock.now += 5_000;
		await write(writer, code, { event: null, entries: [{ team: 7 }] });
		await load(reader, code, first);
		const calls = await commands(async () => {
			const { body } = await load(reader, code, second);
			expect(body.docs.picklist).toBeDefined();
		});
		expect(calls).toEqual([]);
	});

	it('stops spending Redis commands on an address once it is refused', async () => {
		const api = instance();
		for (let i = 0; i <= RATE.miss.limit; i++) await load(api, 'ZZZZZZ');
		const guessing = await commands(async () => {
			for (let i = 0; i < 200; i++) expect((await load(api, 'ZZZZZZ')).status).toBe(429);
		});
		expect(guessing).toEqual([]);
		const code = await create(instance());
		const writing = await commands(async () => {
			for (let i = 0; i < 20; i++) expect((await write(api, code)).status).toBe(429);
		});
		expect(writing).toEqual([]);
	});

	it('stops counting writes to a busy workspace once it hits the limit', async () => {
		const api = instance();
		const code = await create(api);
		for (let i = 0; i < RATE.write.limit; i++) await write(api, code);
		expect((await write(api, code)).status).toBe(429);
		const flood = await commands(async () => {
			for (let i = 0; i < 100; i++) expect((await write(api, code)).status).toBe(429);
		});
		expect(flood).toEqual([]);
	});

	it('still refuses an address that guessed too often, even with a real code', async () => {
		const api = instance();
		const code = await create(api);
		for (let i = 0; i < RATE.miss.limit; i++) await load(api, 'ZZZZZZ');
		expect((await load(api, 'ZZZZZZ')).status).toBe(429);
		expect((await load(api, code)).status).toBe(429);
		expect((await load(api, code, { rev: 'b'.repeat(32) })).status).toBe(429);
	});
});
