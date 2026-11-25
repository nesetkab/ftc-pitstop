import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addItem, toggleItem } from '#lib/workspace/checklist.ts';
import {
	createDeviceStore,
	memoryStorage,
	type DeviceStore,
	type StorageLike
} from '#lib/workspace/device-store.ts';
import { addEntry, moveEntry, setNote } from '#lib/workspace/picklist.ts';
import { WorkspaceError, type WorkspaceStore } from '#lib/workspace/types.ts';
import { Workspace } from '#lib/workspace/workspace.svelte.ts';

let storage: StorageLike;
let device: DeviceStore;
let code: string;

async function open(options: { docs?: Workspace['names'] } = {}) {
	const workspace = new Workspace(code, { flushDelay: 300, retryDelay: 1000, ...options });
	await workspace.open({ stores: [device] });
	return workspace;
}

beforeEach(async () => {
	vi.useFakeTimers();
	storage = memoryStorage();
	device = createDeviceStore(storage);
	code = (await device.create({ teamNumber: 14624 })).code;
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('opening a workspace', () => {
	it('reports a code nobody uses', async () => {
		const workspace = new Workspace('ZZZZZZ');
		await workspace.open({ stores: [device] });
		expect(workspace.status).toBe('missing');
	});

	it('loads the team number and empty documents', async () => {
		const workspace = await open();
		expect(workspace.status).toBe('ready');
		expect(workspace.meta?.teamNumber).toBe(14624);
		expect(workspace.kind).toBe('device');
		expect(workspace.docs.picklist.entries).toEqual([]);
		expect(workspace.docs.checklist.items).toEqual([]);
	});

	it('loads saved documents', async () => {
		await device.write(code, 'picklist', addEntry({ event: null, entries: [] }, 2844, 'Valley X'));
		const workspace = await open();
		expect(workspace.docs.picklist.entries[0]).toMatchObject({ team: 2844, name: 'Valley X' });
	});

	it('only loads the documents it was asked for', async () => {
		await device.write(code, 'picklist', addEntry({ event: null, entries: [] }, 2844));
		const workspace = await open({ docs: ['checklist'] });
		expect(workspace.docs.picklist.entries).toEqual([]);
	});

	it('uses the first store that knows the code', async () => {
		const other = createDeviceStore(memoryStorage());
		const workspace = new Workspace(code);
		await workspace.open({ stores: [other, device] });
		expect(workspace.status).toBe('ready');
	});

	it('reports an error when no store can be reached and nothing is cached', async () => {
		const broken: WorkspaceStore = {
			...device,
			kind: 'shared',
			load: async () => {
				throw new WorkspaceError('unavailable', 'down');
			}
		};
		const workspace = new Workspace(code);
		await workspace.open({ stores: [broken] });
		expect(workspace.status).toBe('error');
	});
});

describe('saving', () => {
	it('shows a change at once and saves it after a short pause', async () => {
		const workspace = await open();
		workspace.update('picklist', (list) => addEntry(list, 2844));
		expect(workspace.docs.picklist.entries).toHaveLength(1);
		expect(workspace.sync).toBe('saving');
		expect((await device.load(code))?.docs.picklist).toBeUndefined();
		await vi.advanceTimersByTimeAsync(300);
		expect(workspace.sync).toBe('saved');
		expect(workspace.savedAt).not.toBeNull();
		expect((await device.load(code))?.docs.picklist?.data.entries).toHaveLength(1);
	});

	it('sends a burst of changes as one write', async () => {
		const workspace = await open();
		const write = vi.spyOn(device, 'write');
		workspace.update('picklist', (list) => addEntry(list, 1));
		workspace.update('picklist', (list) => addEntry(list, 2));
		workspace.update('picklist', (list) => setNote(list, 2, 'Strong auto'));
		await vi.advanceTimersByTimeAsync(300);
		expect(write).toHaveBeenCalledTimes(1);
		const saved = (await device.load(code))?.docs.picklist?.data.entries;
		expect(saved?.map((entry) => entry.team)).toEqual([1, 2]);
		expect(saved?.[1].note).toBe('Strong auto');
	});

	it('ignores changes that change nothing', async () => {
		const workspace = await open();
		const write = vi.spyOn(device, 'write');
		workspace.update('picklist', (list) => list);
		await vi.advanceTimersByTimeAsync(1000);
		expect(write).not.toHaveBeenCalled();
		expect(workspace.sync).toBe('saved');
	});

	it('ignores changes to documents it did not load', async () => {
		const workspace = await open({ docs: ['checklist'] });
		workspace.update('picklist', (list) => addEntry(list, 1));
		expect(workspace.docs.picklist.entries).toEqual([]);
	});

	it('flushes straight away when asked', async () => {
		const workspace = await open();
		workspace.update('checklist', (list) => addItem(list, 'a', 'Battery in'));
		await workspace.flush();
		expect((await device.load(code))?.docs.checklist?.data.items).toHaveLength(1);
		expect(workspace.sync).toBe('saved');
	});

	it('keeps each document separate', async () => {
		const workspace = await open();
		workspace.update('picklist', (list) => addEntry(list, 1));
		workspace.update('checklist', (list) => addItem(list, 'a', 'Battery in'));
		await vi.advanceTimersByTimeAsync(300);
		const snapshot = await device.load(code);
		expect(Object.keys(snapshot?.docs ?? {}).sort()).toEqual(['checklist', 'picklist']);
	});
});

describe('two people editing', () => {
	it('keeps both changes when they touch different things', async () => {
		const alice = await open();
		const bob = await open();
		alice.update('checklist', (list) => addItem(list, 'a', 'Battery in'));
		bob.update('checklist', (list) => addItem(list, 'b', 'Pollen loaded'));
		await alice.flush();
		await bob.flush();
		const saved = (await device.load(code))?.docs.checklist?.data.items.map((item) => item.id);
		expect(saved).toEqual(['a', 'b']);
		expect(bob.docs.checklist.items.map((item) => item.id)).toEqual(['a', 'b']);
	});

	it('keeps a check made on another phone', async () => {
		await device.write(code, 'checklist', {
			match: 'Q26',
			items: [
				{ id: 'a', text: 'Battery in', by: null, at: null },
				{ id: 'b', text: 'Pollen loaded', by: null, at: null }
			],
			history: []
		});
		const alice = await open();
		const bob = await open();
		alice.update('checklist', (list) => toggleItem(list, 'a', 'AL', 1000));
		await alice.flush();
		bob.update('checklist', (list) => toggleItem(list, 'b', 'JR', 2000));
		await bob.flush();
		const items = (await device.load(code))?.docs.checklist?.data.items;
		expect(items?.map((item) => item.by)).toEqual(['AL', 'JR']);
	});

	it('applies the order someone else saved before a later reorder', async () => {
		await device.write(code, 'picklist', {
			event: null,
			entries: [1, 2, 3].map((team) => ({ team, name: null, note: '', taken: false }))
		});
		const alice = await open();
		const bob = await open();
		alice.update('picklist', (list) => moveEntry(list, 3, 0));
		await alice.flush();
		bob.update('picklist', (list) => setNote(list, 1, 'Reliable'));
		await bob.flush();
		const entries = (await device.load(code))?.docs.picklist?.data.entries;
		expect(entries?.map((entry) => entry.team)).toEqual([3, 1, 2]);
		expect(entries?.find((entry) => entry.team === 1)?.note).toBe('Reliable');
	});

	it('picks up changes from another tab when it has nothing waiting', async () => {
		const first = await open();
		const stop = first.start();
		const second = await open();
		second.update('checklist', (list) => addItem(list, 'a', 'From the other tab'));
		await second.flush();
		window.dispatchEvent(new StorageEvent('storage', { key: `ps-ws:${code}:checklist` }));
		await vi.waitFor(() => expect(first.docs.checklist.items).toHaveLength(1));
		stop();
	});

	it('puts waiting changes on top of what arrives from another tab', async () => {
		const first = await open();
		const stop = first.start();
		const second = await open();
		first.update('checklist', (list) => addItem(list, 'mine', 'Mine'));
		second.update('checklist', (list) => addItem(list, 'theirs', 'Theirs'));
		await second.flush();
		window.dispatchEvent(new StorageEvent('storage', { key: `ps-ws:${code}:checklist` }));
		await vi.waitFor(() =>
			expect(first.docs.checklist.items.map((item) => item.id)).toEqual(['theirs', 'mine'])
		);
		await first.flush();
		expect((await device.load(code))?.docs.checklist?.data.items.map((item) => item.id)).toEqual([
			'theirs',
			'mine'
		]);
		stop();
	});
});

describe('trouble saving', () => {
	it('tries again when the store is unreachable', async () => {
		const workspace = await open();
		const write = vi
			.spyOn(device, 'write')
			.mockRejectedValueOnce(new WorkspaceError('unavailable', 'down'));
		workspace.update('picklist', (list) => addEntry(list, 7));
		await vi.advanceTimersByTimeAsync(300);
		expect(workspace.sync).toBe('retrying');
		expect(workspace.offline).toBe(true);
		expect(workspace.message).toBe('Offline. Changes will save when the connection is back.');
		await vi.advanceTimersByTimeAsync(1000);
		expect(write).toHaveBeenCalledTimes(2);
		expect(workspace.sync).toBe('saved');
		expect(workspace.offline).toBe(false);
		expect((await device.load(code))?.docs.picklist?.data.entries).toHaveLength(1);
	});

	it('waits longer after each failure', async () => {
		const workspace = await open();
		const write = vi
			.spyOn(device, 'write')
			.mockRejectedValue(new WorkspaceError('unavailable', 'down'));
		workspace.update('picklist', (list) => addEntry(list, 7));
		await vi.advanceTimersByTimeAsync(300);
		expect(write).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(write).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1500);
		expect(write).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(500);
		expect(write).toHaveBeenCalledTimes(3);
	});

	it('saves right away when the connection comes back or on retry now', async () => {
		const workspace = await open();
		const stop = workspace.start();
		const write = vi
			.spyOn(device, 'write')
			.mockRejectedValueOnce(new WorkspaceError('unavailable', 'down'))
			.mockRejectedValueOnce(new WorkspaceError('unavailable', 'down'));
		workspace.update('picklist', (list) => addEntry(list, 7));
		await vi.advanceTimersByTimeAsync(300);
		expect(workspace.unsaved).toBe(true);
		window.dispatchEvent(new Event('online'));
		await vi.advanceTimersByTimeAsync(0);
		expect(write).toHaveBeenCalledTimes(2);
		expect(workspace.sync).toBe('retrying');
		await workspace.retry();
		expect(write).toHaveBeenCalledTimes(3);
		expect(workspace.sync).toBe('saved');
		expect(workspace.unsaved).toBe(false);
		stop();
	});

	it('stops retrying a change that is too large', async () => {
		const workspace = await open();
		const write = vi
			.spyOn(device, 'write')
			.mockRejectedValue(new WorkspaceError('too-large', 'big'));
		workspace.update('picklist', (list) => addEntry(list, 7));
		await vi.advanceTimersByTimeAsync(300);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(write).toHaveBeenCalledTimes(1);
		expect(workspace.sync).toBe('failed');
		expect(workspace.message).toBe('This is too large to save. Remove some items and try again.');
	});

	it('reports a workspace that disappeared', async () => {
		const workspace = await open();
		device.remove(code);
		workspace.update('picklist', (list) => addEntry(list, 7));
		await vi.advanceTimersByTimeAsync(300);
		expect(workspace.status).toBe('missing');
	});
});

describe('shared workspaces', () => {
	function shared(backing: DeviceStore): WorkspaceStore {
		return { ...backing, kind: 'shared' };
	}

	it('keeps a copy on the device and shows it when the network is down', async () => {
		const cache = createDeviceStore(storage, { prefix: 'ps-cache' });
		const remote = shared(device);
		await device.write(code, 'picklist', addEntry({ event: null, entries: [] }, 2844));
		const online = new Workspace(code);
		await online.open({ stores: [remote], cache });
		expect(online.kind).toBe('shared');
		expect((await cache.load(code))?.docs.picklist?.data.entries).toHaveLength(1);

		const offline = new Workspace(code);
		const down: WorkspaceStore = {
			...remote,
			load: async () => {
				throw new WorkspaceError('unavailable', 'down');
			}
		};
		await offline.open({ stores: [down], cache });
		expect(offline.status).toBe('ready');
		expect(offline.offline).toBe(true);
		expect(offline.docs.picklist.entries[0].team).toBe(2844);
	});

	it('keeps what it saved in the copy too', async () => {
		const cache = createDeviceStore(storage, { prefix: 'ps-cache' });
		const workspace = new Workspace(code, { flushDelay: 300 });
		await workspace.open({ stores: [shared(device)], cache });
		workspace.update('checklist', (list) => addItem(list, 'a', 'Battery in'));
		await vi.advanceTimersByTimeAsync(300);
		expect((await cache.load(code))?.docs.checklist?.data.items).toHaveLength(1);
	});

	it('does not copy workspaces that already live on the device', async () => {
		const cache = createDeviceStore(storage, { prefix: 'ps-cache' });
		const workspace = new Workspace(code, { flushDelay: 300 });
		await workspace.open({ stores: [device], cache });
		workspace.update('checklist', (list) => addItem(list, 'a', 'Battery in'));
		await vi.advanceTimersByTimeAsync(300);
		expect(await cache.load(code)).toBeNull();
	});
});
