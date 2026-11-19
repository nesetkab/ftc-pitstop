import { generateCode, type RandomBytes } from '#lib/workspace/code.ts';
import {
	DOC_NAMES,
	metaSchema,
	putDoc,
	stampedSchemas,
	type DocMap,
	type DocName,
	type Snapshot,
	type Stamped,
	type WorkspaceMeta
} from '#lib/workspace/schemas.ts';
import {
	WorkspaceError,
	hasDocs,
	type LoadOptions,
	type WorkspaceStore,
	type WriteResult
} from '#lib/workspace/types.ts';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export function memoryStorage(): StorageLike {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		key: (index) => [...items.keys()][index] ?? null,
		getItem: (key) => items.get(key) ?? null,
		setItem: (key, value) => {
			items.set(key, String(value));
		},
		removeItem: (key) => {
			items.delete(key);
		}
	};
}

let fallback: StorageLike | null = null;

export function browserStorage(): { storage: StorageLike; persistent: boolean } {
	try {
		const probe = 'ps-probe';
		localStorage.setItem(probe, '1');
		localStorage.removeItem(probe);
		return { storage: localStorage, persistent: true };
	} catch {
		fallback ??= memoryStorage();
		return { storage: fallback, persistent: false };
	}
}

export interface DeviceStore extends WorkspaceStore {
	readonly kind: 'device' | 'memory';
	import(snapshot: Snapshot): void;
	remove(code: string): void;
}

export interface DeviceStoreOptions {
	prefix?: string;
	persistent?: boolean;
	now?: () => number;
	random?: RandomBytes;
}

function readJson(storage: StorageLike, key: string): unknown {
	try {
		const raw = storage.getItem(key);
		return raw === null ? null : JSON.parse(raw);
	} catch {
		return null;
	}
}

function saveJson(storage: StorageLike, key: string, value: unknown) {
	try {
		storage.setItem(key, JSON.stringify(value));
	} catch {
		throw new WorkspaceError('storage', 'This device could not save the change');
	}
}

export function createDeviceStore(
	storage: StorageLike,
	options: DeviceStoreOptions = {}
): DeviceStore {
	const prefix = options.prefix ?? 'ps-ws';
	const now = options.now ?? Date.now;
	const key = (code: string, part: string) => `${prefix}:${code}:${part}`;

	function readMeta(code: string): WorkspaceMeta | null {
		const result = metaSchema.safeParse(readJson(storage, key(code, 'meta')));
		return result.success ? result.data : null;
	}

	function readDoc<K extends DocName>(code: string, name: K): Stamped<DocMap[K]> | null {
		const result = stampedSchemas[name].safeParse(readJson(storage, key(code, name)));
		return result.success ? (result.data as Stamped<DocMap[K]>) : null;
	}

	const store: DeviceStore = {
		kind: options.persistent === false ? 'memory' : 'device',

		async create({ teamNumber }) {
			for (let attempt = 0; attempt < 20; attempt++) {
				const code = generateCode(options.random);
				if (storage.getItem(key(code, 'meta')) !== null) continue;
				const meta: WorkspaceMeta = { code, teamNumber, createdAt: now() };
				saveJson(storage, key(code, 'meta'), meta);
				return meta;
			}
			throw new WorkspaceError('unavailable', 'No free join code was found');
		},

		async load(code, loadOptions: LoadOptions = {}) {
			const meta = readMeta(code);
			if (!meta) return null;
			const snapshot: Snapshot = { meta, docs: {} };
			for (const name of loadOptions.docs ?? DOC_NAMES) {
				const stamped = readDoc(code, name);
				if (!stamped || loadOptions.known?.[name] === stamped.updatedAt) continue;
				putDoc(snapshot.docs, name, stamped);
			}
			return snapshot;
		},

		async write<K extends DocName>(
			code: string,
			doc: K,
			data: DocMap[K],
			base?: number | null
		): Promise<WriteResult<K>> {
			if (!readMeta(code)) throw new WorkspaceError('not-found', 'No workspace uses this code');
			const current = readDoc(code, doc);
			if (base !== undefined && current && current.updatedAt !== base) {
				return { ok: false, current };
			}
			const stamped: Stamped<DocMap[K]> = {
				updatedAt: Math.max(now(), (current?.updatedAt ?? 0) + 1),
				data
			};
			saveJson(storage, key(code, doc), stamped);
			return { ok: true, stamped };
		},

		watch(code, request, onChange) {
			if (typeof window === 'undefined') return () => {};
			const listener = async (event: StorageEvent) => {
				if (event.key !== null && !event.key.startsWith(`${prefix}:${code}:`)) return;
				const snapshot = await store.load(code, request());
				if (hasDocs(snapshot)) onChange(snapshot);
			};
			window.addEventListener('storage', listener);
			return () => window.removeEventListener('storage', listener);
		},

		import(snapshot) {
			saveJson(storage, key(snapshot.meta.code, 'meta'), snapshot.meta);
			for (const name of DOC_NAMES) {
				const stamped = snapshot.docs[name];
				if (stamped) saveJson(storage, key(snapshot.meta.code, name), stamped);
			}
		},

		remove(code) {
			for (const part of ['meta', ...DOC_NAMES]) storage.removeItem(key(code, part));
		}
	};
	return store;
}
