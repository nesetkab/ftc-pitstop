import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	browserStorage,
	createDeviceStore,
	memoryStorage,
	type DeviceStore
} from '#lib/workspace/device-store.ts';
import { emptyDoc, type Checklist } from '#lib/workspace/schemas.ts';
import { WorkspaceError } from '#lib/workspace/types.ts';

let time = 1_700_000_000_000;
const now = () => time;

function checklist(text: string): Checklist {
	return {
		match: 'Q1',
		items: [{ id: 'a', text, by: null, at: null }],
		history: []
	};
}

beforeEach(() => {
	localStorage.clear();
	time = 1_700_000_000_000;
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('device store', () => {
	it('creates a workspace with a join code and the team number', async () => {
		const store = createDeviceStore(localStorage, { now });
		const meta = await store.create({ teamNumber: 14624 });
		expect(meta.code).toMatch(/^[A-Z2-9]{6}$/);
		expect(meta).toMatchObject({ teamNumber: 14624, createdAt: time });
		expect(await store.load(meta.code)).toEqual({ meta, docs: {} });
	});

	it('answers null for a code it does not have', async () => {
		const store = createDeviceStore(localStorage, { now });
		expect(await store.load('ZZZZZZ')).toBeNull();
	});

	it('does not reuse a code that exists', async () => {
		const sequence = [
			new Uint8Array(12).fill(0),
			new Uint8Array(12).fill(0),
			new Uint8Array(12).fill(1)
		];
		const random = () => sequence.shift() ?? new Uint8Array(12).fill(2);
		const store = createDeviceStore(localStorage, { now, random });
		const first = await store.create({ teamNumber: null });
		const second = await store.create({ teamNumber: null });
		expect(first.code).toBe('AAAAAA');
		expect(second.code).toBe('BBBBBB');
	});

	it('stores and loads each document with its own updatedAt', async () => {
		const store = createDeviceStore(localStorage, { now });
		const { code } = await store.create({ teamNumber: 1 });
		const written = await store.write(code, 'checklist', checklist('Battery in'));
		expect(written).toEqual({
			ok: true,
			stamped: { updatedAt: time, data: checklist('Battery in') }
		});
		const snapshot = await store.load(code);
		expect(snapshot?.docs.checklist).toEqual({ updatedAt: time, data: checklist('Battery in') });
		expect(snapshot?.docs.picklist).toBeUndefined();
	});

	it('keeps updatedAt increasing when writes land in the same millisecond', async () => {
		const store = createDeviceStore(localStorage, { now });
		const { code } = await store.create({ teamNumber: 1 });
		const first = await store.write(code, 'checklist', checklist('One'));
		const second = await store.write(code, 'checklist', checklist('Two'));
		if (!first.ok || !second.ok) throw new Error('write failed');
		expect(second.stamped.updatedAt).toBeGreaterThan(first.stamped.updatedAt);
	});

	it('lets the last write win when no base version is given', async () => {
		const store = createDeviceStore(localStorage, { now });
		const { code } = await store.create({ teamNumber: 1 });
		await store.write(code, 'checklist', checklist('One'));
		time += 1000;
		await store.write(code, 'checklist', checklist('Two'));
		const snapshot = await store.load(code);
		expect(snapshot?.docs.checklist?.data.items[0].text).toBe('Two');
	});

	it('reports a conflict when the base version is stale', async () => {
		const store = createDeviceStore(localStorage, { now });
		const { code } = await store.create({ teamNumber: 1 });
		const first = await store.write(code, 'checklist', checklist('One'), null);
		if (!first.ok) throw new Error('write failed');
		time += 1000;
		const second = await store.write(code, 'checklist', checklist('Two'), first.stamped.updatedAt);
		expect(second.ok).toBe(true);
		const stale = await store.write(code, 'checklist', checklist('Three'), first.stamped.updatedAt);
		expect(stale.ok).toBe(false);
		if (!stale.ok) expect(stale.current.data.items[0].text).toBe('Two');
		const expectedEmpty = await store.write(code, 'checklist', checklist('Four'), null);
		expect(expectedEmpty.ok).toBe(false);
	});

	it('accepts a first write against an empty document', async () => {
		const store = createDeviceStore(localStorage, { now });
		const { code } = await store.create({ teamNumber: 1 });
		const result = await store.write(code, 'picklist', emptyDoc('picklist'), null);
		expect(result.ok).toBe(true);
	});

	it('refuses to write to a workspace that does not exist', async () => {
		const store = createDeviceStore(localStorage, { now });
		await expect(store.write('ZZZZZZ', 'picklist', emptyDoc('picklist'))).rejects.toMatchObject({
			code: 'not-found'
		});
	});

	it('only returns documents that changed since the known versions', async () => {
		const store = createDeviceStore(localStorage, { now });
		const { code } = await store.create({ teamNumber: 1 });
		const a = await store.write(code, 'checklist', checklist('One'));
		await store.write(code, 'picklist', emptyDoc('picklist'));
		if (!a.ok) throw new Error('write failed');
		const snapshot = await store.load(code, { known: { checklist: a.stamped.updatedAt } });
		expect(Object.keys(snapshot?.docs ?? {})).toEqual(['picklist']);
		const only = await store.load(code, { docs: ['checklist'] });
		expect(Object.keys(only?.docs ?? {})).toEqual(['checklist']);
	});

	it('ignores corrupt or invalid stored documents', async () => {
		const store = createDeviceStore(localStorage, { now });
		const { code } = await store.create({ teamNumber: 1 });
		localStorage.setItem(`ps-ws:${code}:picklist`, '{nope');
		localStorage.setItem(`ps-ws:${code}:batteries`, JSON.stringify({ updatedAt: 1, data: 5 }));
		const snapshot = await store.load(code);
		expect(snapshot?.docs).toEqual({});
	});

	it('treats corrupt metadata as a missing workspace', async () => {
		const store = createDeviceStore(localStorage, { now });
		localStorage.setItem('ps-ws:ABCDEF:meta', '{"code":"ABCDEF"}');
		expect(await store.load('ABCDEF')).toBeNull();
	});

	it('keeps workspaces apart', async () => {
		const store = createDeviceStore(localStorage, { now });
		const a = await store.create({ teamNumber: 1 });
		const b = await store.create({ teamNumber: 2 });
		await store.write(a.code, 'checklist', checklist('For A'));
		expect((await store.load(b.code))?.docs.checklist).toBeUndefined();
	});

	it('surfaces a full or blocked disk as a storage error', async () => {
		const store = createDeviceStore(localStorage, { now });
		const { code } = await store.create({ teamNumber: 1 });
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('full', 'QuotaExceededError');
		});
		await expect(store.write(code, 'checklist', checklist('One'))).rejects.toBeInstanceOf(
			WorkspaceError
		);
		await expect(store.write(code, 'checklist', checklist('One'))).rejects.toMatchObject({
			code: 'storage'
		});
	});

	it('imports and removes whole workspaces', async () => {
		const store = createDeviceStore(localStorage, { now });
		store.import({
			meta: { code: 'ABCD3F', teamNumber: 7, createdAt: 5 },
			docs: { checklist: { updatedAt: 9, data: checklist('Imported') } }
		});
		const snapshot = await store.load('ABCD3F');
		expect(snapshot?.docs.checklist?.updatedAt).toBe(9);
		store.remove('ABCD3F');
		expect(await store.load('ABCD3F')).toBeNull();
		expect(localStorage.length).toBe(0);
	});

	it('uses separate keys for a different prefix', async () => {
		const main = createDeviceStore(localStorage, { now });
		const cache = createDeviceStore(localStorage, { now, prefix: 'ps-cache' });
		const { code } = await main.create({ teamNumber: 1 });
		expect(await cache.load(code)).toBeNull();
	});
});

describe('device store watching', () => {
	let store: DeviceStore;
	let code: string;

	beforeEach(async () => {
		store = createDeviceStore(localStorage, { now });
		code = (await store.create({ teamNumber: 1 })).code;
	});

	it('reports changes made in another tab', async () => {
		const changes: string[][] = [];
		const stop = store.watch?.(
			code,
			() => ({}),
			(snapshot) => changes.push(Object.keys(snapshot.docs))
		);
		await store.write(code, 'checklist', checklist('From another tab'));
		window.dispatchEvent(new StorageEvent('storage', { key: `ps-ws:${code}:checklist` }));
		await vi.waitFor(() => expect(changes).toEqual([['checklist']]));
		stop?.();
	});

	it('ignores other workspaces and stops after unsubscribing', async () => {
		const changes: string[][] = [];
		const stop = store.watch?.(
			code,
			() => ({}),
			(snapshot) => changes.push(Object.keys(snapshot.docs))
		);
		await store.write(code, 'checklist', checklist('One'));
		window.dispatchEvent(new StorageEvent('storage', { key: 'ps-ws:OTHER2:checklist' }));
		window.dispatchEvent(new StorageEvent('storage', { key: 'ps-theme' }));
		stop?.();
		window.dispatchEvent(new StorageEvent('storage', { key: `ps-ws:${code}:checklist` }));
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(changes).toEqual([]);
	});
});

describe('browser storage', () => {
	it('uses local storage when it works', () => {
		const result = browserStorage();
		expect(result.persistent).toBe(true);
		expect(result.storage).toBe(localStorage);
	});

	it('falls back to memory when storage is blocked', async () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('blocked', 'SecurityError');
		});
		const result = browserStorage();
		expect(result.persistent).toBe(false);
		const store = createDeviceStore(result.storage, { now, persistent: result.persistent });
		expect(store.kind).toBe('memory');
		const meta = await store.create({ teamNumber: 3 });
		expect((await store.load(meta.code))?.meta.teamNumber).toBe(3);
	});

	it('memory storage behaves like storage', () => {
		const storage = memoryStorage();
		storage.setItem('a', '1');
		storage.setItem('b', '2');
		expect(storage.length).toBe(2);
		expect(storage.key(1)).toBe('b');
		expect(storage.getItem('missing')).toBeNull();
		storage.removeItem('a');
		expect(storage.length).toBe(1);
	});
});
