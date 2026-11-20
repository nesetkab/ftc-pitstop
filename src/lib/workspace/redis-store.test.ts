import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeRedis, type FakeRedis } from '#lib/workspace/fake-redis.ts';
import { createLimiter } from '#lib/workspace/limit.ts';
import {
	createRedisStore,
	DOC_BYTE_LIMITS,
	WORKSPACE_TTL_SECONDS
} from '#lib/workspace/redis-store.ts';
import { emptyDoc, type Boards, type Checklist, type Shape } from '#lib/workspace/schemas.ts';
import type { WorkspaceStore } from '#lib/workspace/types.ts';

let time: number;
let redis: FakeRedis;
let store: WorkspaceStore;

function checklist(text: string): Checklist {
	return { match: 'Q1', items: [{ id: 'a', text, by: null, at: null }], history: [] };
}

beforeEach(() => {
	time = 1_700_000_000_000;
	redis = createFakeRedis(() => time);
	store = createRedisStore(redis, { now: () => time });
});

describe('redis workspace store', () => {
	it('creates a workspace under an unused code with a long expiry', async () => {
		const meta = await store.create({ teamNumber: 14624 });
		expect(meta).toMatchObject({ teamNumber: 14624, createdAt: time });
		expect(meta.code).toMatch(/^[A-Z2-9]{6}$/);
		expect(redis.keys()).toEqual([`pitstop:ws:${meta.code}:meta`]);
		expect(redis.ttl(`pitstop:ws:${meta.code}:meta`)).toBe(WORKSPACE_TTL_SECONDS);
	});

	it('tries another code when one is taken', async () => {
		const bytes = [
			new Uint8Array(12).fill(0),
			new Uint8Array(12).fill(0),
			new Uint8Array(12).fill(4)
		];
		const seeded = createRedisStore(redis, {
			now: () => time,
			random: () => bytes.shift() ?? new Uint8Array(12).fill(9)
		});
		expect((await seeded.create({ teamNumber: null })).code).toBe('AAAAAA');
		expect((await seeded.create({ teamNumber: null })).code).toBe('EEEEEE');
	});

	it('gives up when every code is taken', async () => {
		const stuck = createRedisStore(redis, { now: () => time, random: () => new Uint8Array(12) });
		await stuck.create({ teamNumber: null });
		await expect(stuck.create({ teamNumber: null })).rejects.toMatchObject({
			code: 'unavailable'
		});
	});

	it('loads metadata and documents in one round trip', async () => {
		const { code } = await store.create({ teamNumber: 7 });
		await store.write(code, 'checklist', checklist('Battery in'));
		redis.calls.length = 0;
		const snapshot = await store.load(code);
		expect(redis.calls).toEqual(['mget']);
		expect(snapshot?.meta.teamNumber).toBe(7);
		expect(Object.keys(snapshot?.docs ?? {})).toEqual(['checklist']);
	});

	it('answers null for an unknown code', async () => {
		expect(await store.load('ZZZZZZ')).toBeNull();
	});

	it('leaves out documents the caller already has', async () => {
		const { code } = await store.create({ teamNumber: 7 });
		const first = await store.write(code, 'checklist', checklist('One'));
		await store.write(code, 'picklist', emptyDoc('picklist'));
		if (!first.ok) throw new Error('write failed');
		const snapshot = await store.load(code, { known: { checklist: first.stamped.updatedAt } });
		expect(Object.keys(snapshot?.docs ?? {})).toEqual(['picklist']);
		const same = await store.load(code, { docs: ['batteries'] });
		expect(same?.docs).toEqual({});
	});

	it('requires the workspace to exist before writing', async () => {
		await expect(store.write('ZZZZZZ', 'checklist', checklist('x'))).rejects.toMatchObject({
			code: 'not-found'
		});
		expect(redis.keys()).toEqual([]);
	});

	it('lets the last write win without a base version', async () => {
		const { code } = await store.create({ teamNumber: 7 });
		await store.write(code, 'checklist', checklist('One'));
		time += 5;
		await store.write(code, 'checklist', checklist('Two'));
		expect((await store.load(code))?.docs.checklist?.data.items[0].text).toBe('Two');
	});

	it('returns the current document when the base version is stale', async () => {
		const { code } = await store.create({ teamNumber: 7 });
		const first = await store.write(code, 'checklist', checklist('One'), null);
		if (!first.ok) throw new Error('write failed');
		time += 5;
		const mine = await store.write(code, 'checklist', checklist('Mine'), first.stamped.updatedAt);
		if (!mine.ok) throw new Error('write failed');
		time += 5;
		const theirs = await store.write(
			code,
			'checklist',
			checklist('Theirs'),
			first.stamped.updatedAt
		);
		expect(theirs.ok).toBe(false);
		if (!theirs.ok) {
			expect(theirs.current.updatedAt).toBe(mine.stamped.updatedAt);
			expect(theirs.current.data.items[0].text).toBe('Mine');
		}
	});

	it('stamps every write later than the one before it', async () => {
		const { code } = await store.create({ teamNumber: 7 });
		const a = await store.write(code, 'checklist', checklist('A'));
		const b = await store.write(code, 'checklist', checklist('B'));
		if (!a.ok || !b.ok) throw new Error('write failed');
		expect(b.stamped.updatedAt).toBe(a.stamped.updatedAt + 1);
	});

	it('refreshes the expiry of the workspace on every write', async () => {
		const { code } = await store.create({ teamNumber: 7 });
		time += 100 * 86_400 * 1000;
		await store.write(code, 'checklist', checklist('One'));
		expect(redis.ttl(`pitstop:ws:${code}:meta`)).toBe(WORKSPACE_TTL_SECONDS);
		expect(redis.ttl(`pitstop:ws:${code}:checklist`)).toBe(WORKSPACE_TTL_SECONDS);
	});

	it('refuses documents over the size limit', async () => {
		const { code } = await store.create({ teamNumber: 7 });
		const pen = (id: string): Shape => ({
			id,
			kind: 'pen',
			color: 'ink',
			dash: false,
			pts: Array.from({ length: 60 }, (_, index) => 100 + (index % 9) * 11.1)
		});
		const big: Boards = {
			plans: Array.from({ length: 4 }, (_, plan) => ({
				id: `plan${plan}`,
				name: 'Plan',
				notes: '',
				updatedAt: 1,
				shapes: Array.from({ length: 400 }, (_, shape) => pen(`s${shape}`))
			}))
		};
		expect(JSON.stringify(big).length).toBeGreaterThan(DOC_BYTE_LIMITS.boards);
		await expect(store.write(code, 'boards', big)).rejects.toMatchObject({ code: 'too-large' });
		expect((await store.load(code))?.docs.boards).toBeUndefined();
	});

	it('ignores stored documents that no longer match the schema', async () => {
		const { code } = await store.create({ teamNumber: 7 });
		await redis.set(`pitstop:ws:${code}:picklist`, '{"updatedAt":1,"data":{"entries":"no"}}');
		await redis.set(`pitstop:ws:${code}:batteries`, 'not json');
		expect((await store.load(code))?.docs).toEqual({});
	});

	it('accepts values a client library already decoded', async () => {
		const { code } = await store.create({ teamNumber: 7 });
		const decoded = {
			get: async (key: string) => {
				const raw = await redis.get(key);
				return typeof raw === 'string' ? JSON.parse(raw) : raw;
			},
			mget: async (...keys: string[]) =>
				(await redis.mget(...keys)).map((raw) => (typeof raw === 'string' ? JSON.parse(raw) : raw)),
			set: redis.set.bind(redis),
			incr: redis.incr.bind(redis),
			decr: redis.decr.bind(redis),
			expire: redis.expire.bind(redis)
		};
		const other = createRedisStore(decoded, { now: () => time });
		await other.write(code, 'checklist', checklist('One'));
		expect((await other.load(code))?.docs.checklist?.data.items[0].text).toBe('One');
	});
});

describe('rate limiter', () => {
	it('allows up to the limit inside a window and recovers in the next one', async () => {
		const limiter = createLimiter(redis, { now: () => time });
		const results: boolean[] = [];
		for (let i = 0; i < 5; i++) results.push(await limiter.allow('key', 3, 60));
		expect(results).toEqual([true, true, true, false, false]);
		expect(await limiter.used('key', 60)).toBe(5);
		time += 61_000;
		expect(await limiter.allow('key', 3, 60)).toBe(true);
		expect(await limiter.used('key', 60)).toBe(1);
	});

	it('counts names separately and expires old windows', async () => {
		const limiter = createLimiter(redis, { now: () => time });
		await limiter.allow('a', 1, 60);
		expect(await limiter.allow('b', 1, 60)).toBe(true);
		expect(await limiter.used('missing', 60)).toBe(0);
		time += 130_000;
		expect(redis.keys()).toEqual([]);
	});
});
