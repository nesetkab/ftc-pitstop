import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createDeviceStore,
	memoryStorage,
	type DeviceStore,
	type StorageLike
} from '#lib/workspace/device-store.ts';
import { createPendingStore, type PendingStore } from '#lib/workspace/pending.ts';
import { addEntry, setNote } from '#lib/workspace/picklist.ts';
import { WorkspaceError, type WorkspaceStore } from '#lib/workspace/types.ts';
import { Workspace, type WorkspaceAccess } from '#lib/workspace/workspace.svelte.ts';

let server: StorageLike;
let phone: StorageLike;
let backing: DeviceStore;
let cache: DeviceStore;
let pending: PendingStore;
let code: string;
let up: boolean;

const down = () => new WorkspaceError('unavailable', 'down');

function remote(): WorkspaceStore {
	return {
		...backing,
		kind: 'shared',
		load: async (...args) => {
			if (!up) throw down();
			return backing.load(...args);
		},
		write: async (...args) => {
			if (!up) throw down();
			return backing.write(...args);
		}
	};
}

function access(stores: WorkspaceStore[] = [remote()]): WorkspaceAccess {
	return { stores, cache, pending };
}

async function open(options: { access?: WorkspaceAccess } = {}) {
	const workspace = new Workspace(code, { flushDelay: 300, retryDelay: 1000 });
	await workspace.open(options.access ?? access());
	return workspace;
}

async function serverTeams() {
	return (await backing.load(code))?.docs.picklist?.data.entries.map((entry) => entry.team);
}

beforeEach(async () => {
	vi.useFakeTimers();
	server = memoryStorage();
	phone = memoryStorage();
	backing = createDeviceStore(server);
	cache = createDeviceStore(phone, { prefix: 'ps-cache' });
	pending = createPendingStore(phone);
	code = (await backing.create({ teamNumber: 14624 })).code;
	await backing.write(code, 'picklist', addEntry({ event: null, entries: [] }, 2844));
	up = true;
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('offline workspace edits', () => {
	it('keeps unsaved changes on the device and forgets them once saved', async () => {
		const workspace = await open();
		up = false;
		workspace.update('picklist', (list) => addEntry(list, 7));
		expect(pending.read(code, 'picklist')?.data.entries).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(300);
		expect(workspace.unsaved).toBe(true);
		expect(pending.read(code, 'picklist')).not.toBeNull();
		up = true;
		await workspace.retry();
		expect(workspace.sync).toBe('saved');
		expect(pending.read(code, 'picklist')).toBeNull();
		expect(await serverTeams()).toEqual([2844, 7]);
	});

	it('saves changes from a closed tab on the next visit', async () => {
		const first = await open();
		up = false;
		first.update('picklist', (list) => addEntry(list, 7));
		await vi.advanceTimersByTimeAsync(300);

		up = true;
		const next = await open();
		expect(next.docs.picklist.entries.map((entry) => entry.team)).toEqual([2844, 7]);
		await vi.advanceTimersByTimeAsync(300);
		expect(next.sync).toBe('saved');
		expect(await serverTeams()).toEqual([2844, 7]);
		expect(pending.read(code, 'picklist')).toBeNull();
	});

	it('shows unsaved changes after a reload with no connection and saves them when it returns', async () => {
		const first = await open();
		up = false;
		first.update('picklist', (list) => addEntry(list, 7));
		await vi.advanceTimersByTimeAsync(300);

		const reloaded = await open();
		const stop = reloaded.start();
		expect(reloaded.status).toBe('ready');
		expect(reloaded.offline).toBe(true);
		expect(reloaded.docs.picklist.entries.map((entry) => entry.team)).toEqual([2844, 7]);
		await vi.advanceTimersByTimeAsync(300);
		expect(reloaded.sync).toBe('retrying');
		expect(reloaded.message).toBe(
			'Offline. Not saved yet, will retry when the connection is back.'
		);

		up = true;
		window.dispatchEvent(new Event('online'));
		await vi.advanceTimersByTimeAsync(0);
		expect(reloaded.sync).toBe('saved');
		expect(await serverTeams()).toEqual([2844, 7]);
		stop();
	});

	it('keeps what teammates saved in the meantime', async () => {
		const first = await open();
		up = false;
		first.update('picklist', (list) => setNote(addEntry(list, 7), 2844, 'fast intake'));
		await vi.advanceTimersByTimeAsync(300);

		const current = await backing.load(code);
		const saved = current?.docs.picklist;
		if (!saved) throw new Error('missing picklist');
		await backing.write(code, 'picklist', addEntry(saved.data, 99), saved.updatedAt);

		up = true;
		const next = await open();
		await vi.advanceTimersByTimeAsync(300);
		expect(next.sync).toBe('saved');
		expect(await serverTeams()).toEqual([2844, 99, 7]);
		const stored = await backing.load(code);
		expect(stored?.docs.picklist?.data.entries[0].note).toBe('fast intake');
	});

	it('does not keep a queue for workspaces that live on the device', async () => {
		const device = createDeviceStore(phone);
		const local = (await device.create({ teamNumber: null })).code;
		const workspace = new Workspace(local, { flushDelay: 300 });
		await workspace.open({ stores: [device], pending });
		workspace.update('picklist', (list) => addEntry(list, 7));
		expect(pending.read(local, 'picklist')).toBeNull();
	});
});
