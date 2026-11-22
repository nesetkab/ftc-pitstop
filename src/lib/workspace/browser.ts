import {
	browserStorage,
	createDeviceStore,
	type DeviceStore,
	type StorageLike
} from '#lib/workspace/device-store.ts';
import { createPendingStore } from '#lib/workspace/pending.ts';
import { createRemoteStore } from '#lib/workspace/remote-store.ts';
import type { WorkspaceAccess } from '#lib/workspace/workspace.svelte.ts';
import type { WorkspaceStore } from '#lib/workspace/types.ts';

export interface BrowserWorkspaces {
	storage: StorageLike;
	persistent: boolean;
	device: DeviceStore;
	remote: WorkspaceStore | null;
	access: WorkspaceAccess;
}

export function browserWorkspaces(shared: boolean): BrowserWorkspaces {
	const { storage, persistent } = browserStorage();
	const device = createDeviceStore(storage, { persistent });
	const remote = shared ? createRemoteStore() : null;
	const cache = remote ? createDeviceStore(storage, { prefix: 'ps-cache', persistent }) : null;
	return {
		storage,
		persistent,
		device,
		remote,
		access: {
			stores: remote ? [remote, device] : [device],
			cache,
			pending: remote ? createPendingStore(storage) : null
		}
	};
}
