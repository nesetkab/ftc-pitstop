import { getContext, setContext } from 'svelte';
import type { DeviceStore } from '#lib/workspace/device-store.ts';
import { replayEdit, type PendingStore } from '#lib/workspace/pending.ts';
import {
	DOC_NAMES,
	emptyDoc,
	emptyDocs,
	type DocMap,
	type DocName,
	type Snapshot,
	type Stamped,
	type WorkspaceMeta
} from '#lib/workspace/schemas.ts';
import {
	WorkspaceError,
	type Versions,
	type WorkspaceKind,
	type WorkspaceStore
} from '#lib/workspace/types.ts';

export type WorkspaceStatus = 'loading' | 'ready' | 'missing' | 'error';

export type SyncState = 'saved' | 'saving' | 'retrying' | 'failed';

export type Change<K extends DocName> = (doc: DocMap[K]) => DocMap[K];

type AnyChange = (doc: DocMap[DocName]) => DocMap[DocName];

export interface WorkspaceAccess {
	stores: readonly WorkspaceStore[];
	cache?: DeviceStore | null;
	pending?: PendingStore | null;
}

export interface WorkspaceOptions {
	docs?: readonly DocName[];
	now?: () => number;
	flushDelay?: number;
	retryDelay?: number;
}

const MAX_RETRY_DELAY = 30_000;
const MAX_REBASES = 4;

function withDoc<K extends DocName>(docs: DocMap, name: K, value: DocMap[K]): DocMap {
	return { ...docs, [name]: value };
}

export class Workspace {
	readonly code: string;
	readonly names: readonly DocName[];

	status = $state<WorkspaceStatus>('loading');
	meta = $state.raw<WorkspaceMeta | null>(null);
	docs = $state.raw<DocMap>(emptyDocs());
	kind = $state<WorkspaceKind>('device');
	sync = $state<SyncState>('saved');
	savedAt = $state<number | null>(null);
	offline = $state(false);
	message = $state<string | null>(null);

	#stores: readonly WorkspaceStore[] = [];
	#cache: DeviceStore | null = null;
	#saved: PendingStore | null = null;
	#confirmed: Partial<DocMap> = {};
	#store: WorkspaceStore | null = null;
	#versions: Versions = {};
	#rev: string | undefined;
	#key: string | undefined;
	#pending: Partial<Record<DocName, AnyChange[]>> = {};
	#timers: Partial<Record<DocName, ReturnType<typeof setTimeout>>> = {};
	#running: Partial<Record<DocName, boolean>> = {};
	#failures = 0;
	#now: () => number;
	#flushDelay: number;
	#retryDelay: number;

	constructor(code: string, options: WorkspaceOptions = {}) {
		this.code = code;
		this.names = options.docs ?? DOC_NAMES;
		this.#now = options.now ?? Date.now;
		this.#flushDelay = options.flushDelay ?? 300;
		this.#retryDelay = options.retryDelay ?? 4_000;
	}

	async open(access: WorkspaceAccess): Promise<void> {
		this.#stores = access.stores;
		this.#cache = access.cache ?? null;
		this.#saved = access.pending ?? null;
		this.status = 'loading';
		const cached = await this.#cache?.load(this.code, { docs: this.names });
		if (cached) this.#apply(cached, false);
		this.#restore();
		let unreachable: WorkspaceStore | null = null;
		for (const store of this.#stores) {
			try {
				const snapshot = await store.load(this.code, { docs: this.names });
				if (!snapshot) continue;
				this.#store = store;
				this.kind = store.kind;
				this.offline = false;
				this.#apply(snapshot, true);
				this.status = 'ready';
				return;
			} catch {
				unreachable ??= store;
			}
		}
		if (unreachable && cached) {
			this.#store = unreachable;
			this.kind = unreachable.kind;
			this.offline = true;
			this.status = 'ready';
			this.#resume();
			return;
		}
		this.status = unreachable ? 'error' : 'missing';
	}

	start(): () => void {
		const store = this.#store;
		const stops: (() => void)[] = [];
		if (store?.watch) {
			stops.push(
				store.watch(
					this.code,
					() => ({
						known: { ...this.#versions },
						docs: this.names,
						rev: this.#rev,
						key: this.#key
					}),
					(snapshot) => this.#apply(snapshot, true)
				)
			);
		}
		const hidden = () => {
			if (document.visibilityState === 'hidden') void this.flush();
		};
		const leave = () => void this.flush();
		const online = () => void this.retry();
		const offline = () => {
			if (this.kind === 'shared') this.offline = true;
		};
		document.addEventListener('visibilitychange', hidden);
		window.addEventListener('pagehide', leave);
		window.addEventListener('online', online);
		window.addEventListener('offline', offline);
		stops.push(() => {
			document.removeEventListener('visibilitychange', hidden);
			window.removeEventListener('pagehide', leave);
			window.removeEventListener('online', online);
			window.removeEventListener('offline', offline);
		});
		return () => {
			for (const stop of stops) stop();
			for (const timer of Object.values(this.#timers)) clearTimeout(timer);
			this.#timers = {};
		};
	}

	update<K extends DocName>(name: K, change: Change<K>): void {
		if (this.status !== 'ready' || !this.names.includes(name)) return;
		const current = this.docs[name];
		const next = change(current);
		if (Object.is(next, current)) return;
		this.docs = withDoc(this.docs, name, next);
		const queue: AnyChange[] = this.#pending[name] ?? [];
		queue.push(change as unknown as AnyChange);
		this.#pending[name] = queue;
		this.sync = 'saving';
		this.message = null;
		this.#persist(name);
		this.#schedule(name, this.#flushDelay);
	}

	get unsaved(): boolean {
		return this.sync === 'retrying' || this.sync === 'failed';
	}

	async retry(): Promise<void> {
		this.#failures = 0;
		if (this.names.some((name) => this.#queued(name) > 0)) this.sync = 'saving';
		await this.flush();
	}

	async flush(): Promise<void> {
		await Promise.all(
			this.names.map((name) => {
				clearTimeout(this.#timers[name]);
				delete this.#timers[name];
				return this.#write(name);
			})
		);
	}

	#schedule(name: DocName, delay: number) {
		clearTimeout(this.#timers[name]);
		this.#timers[name] = setTimeout(() => {
			delete this.#timers[name];
			void this.#write(name);
		}, delay);
	}

	#queued(name: DocName): number {
		return this.#pending[name]?.length ?? 0;
	}

	#settle() {
		const busy = this.names.some((name) => this.#queued(name) > 0 || this.#running[name] === true);
		if (!busy && this.sync !== 'failed') this.sync = 'saved';
	}

	#apply(snapshot: Snapshot, confirmed: boolean) {
		this.meta = snapshot.meta;
		if (confirmed) {
			this.#rev = snapshot.rev ?? this.#rev;
			this.#key = snapshot.key ?? this.#key;
		}
		let docs = this.docs;
		for (const name of this.names) {
			const stamped = snapshot.docs[name];
			if (!stamped) continue;
			if (confirmed && stamped.updatedAt < (this.#versions[name] ?? 0)) continue;
			if (confirmed) this.#versions[name] = stamped.updatedAt;
			this.#confirmed = { ...this.#confirmed, [name]: stamped.data };
			docs = withDoc(docs, name, this.#rebase(name, stamped.data));
		}
		this.docs = docs;
		if (confirmed) this.#mirror(snapshot);
		this.#resume();
	}

	#resume() {
		for (const name of this.names) {
			if (this.#queued(name) > 0 && !this.#running[name]) {
				this.#schedule(name, this.#flushDelay);
			}
		}
	}

	#restore() {
		if (!this.#saved) return;
		let docs = this.docs;
		for (const name of this.names) {
			const edit = this.#saved.read(this.code, name);
			if (!edit || this.#queued(name) > 0) continue;
			const change = replayEdit(edit) as unknown as AnyChange;
			this.#pending[name] = [change];
			docs = withDoc(docs, name, change(docs[name]));
			this.sync = 'saving';
		}
		this.docs = docs;
	}

	#persist(name: DocName) {
		if (!this.#saved || this.#store?.kind !== 'shared') return;
		if (this.#queued(name) === 0) {
			this.#saved.clear(this.code, name);
			return;
		}
		this.#saved.save(this.code, name, {
			from: this.#confirmed[name] ?? emptyDoc(name),
			data: this.docs[name]
		});
	}

	#rebase<K extends DocName>(name: K, base: DocMap[K]): DocMap[K] {
		const queue = (this.#pending[name] ?? []) as unknown as Change<K>[];
		return queue.reduce((doc, change) => change(doc), base);
	}

	#mirror(snapshot: Snapshot) {
		if (!this.#cache || this.#store?.kind !== 'shared') return;
		try {
			this.#cache.import(snapshot);
		} catch {
			return;
		}
	}

	async #write(name: DocName): Promise<void> {
		const store = this.#store;
		if (!store || this.#running[name] || this.#queued(name) === 0) {
			this.#settle();
			return;
		}
		this.#running[name] = true;
		let retry = false;
		try {
			for (let attempt = 0; attempt < MAX_REBASES; attempt++) {
				const sent = this.#queued(name);
				const result = await store.write(
					this.code,
					name,
					this.docs[name],
					this.#versions[name] ?? null
				);
				if (result.ok) {
					this.#versions[name] = result.stamped.updatedAt;
					this.#confirmed = { ...this.#confirmed, [name]: result.stamped.data };
					this.#pending[name] = (this.#pending[name] ?? []).slice(sent);
					this.savedAt = this.#now();
					this.offline = false;
					this.#failures = 0;
					this.#remember(name, result.stamped);
					break;
				}
				this.#versions[name] = result.current.updatedAt;
				this.#confirmed = { ...this.#confirmed, [name]: result.current.data };
				this.docs = withDoc(this.docs, name, this.#rebase(name, result.current.data));
			}
		} catch (error) {
			retry = this.#fail(name, error);
		} finally {
			delete this.#running[name];
			this.#persist(name);
		}
		if (this.#queued(name) > 0) {
			this.sync = retry ? 'retrying' : 'saving';
			this.#schedule(name, retry ? this.#backoff() : this.#flushDelay);
		} else {
			this.#settle();
		}
	}

	#remember<K extends DocName>(name: K, stamped: Stamped<DocMap[K]>) {
		if (!this.#cache || !this.meta || this.#store?.kind !== 'shared') return;
		try {
			this.#cache.import({ meta: this.meta, docs: { [name]: stamped } });
		} catch {
			return;
		}
	}

	#backoff(): number {
		return Math.min(this.#retryDelay * 2 ** Math.max(this.#failures - 1, 0), MAX_RETRY_DELAY);
	}

	#fail(name: DocName, error: unknown): boolean {
		const code = error instanceof WorkspaceError ? error.code : 'unavailable';
		if (code === 'too-large' || code === 'invalid') {
			this.#pending[name] = [];
			this.sync = 'failed';
			this.message =
				code === 'too-large'
					? 'This is too large to save. Remove some items and try again.'
					: 'This change could not be saved.';
			return false;
		}
		if (code === 'not-found') {
			this.#pending[name] = [];
			this.status = 'missing';
			return false;
		}
		this.#failures += 1;
		this.offline = code === 'unavailable' || code === 'storage';
		this.message =
			code === 'rate-limited'
				? 'Too many changes at once. Saving again shortly.'
				: this.offline
					? 'Offline. Changes will save when the connection is back.'
					: 'Not saved yet. Trying again.';
		return true;
	}
}

const KEY = Symbol('workspace');

export function setWorkspace(workspace: Workspace) {
	setContext(KEY, workspace);
}

export function getWorkspace(): Workspace {
	const workspace = getContext<Workspace | undefined>(KEY);
	if (!workspace) throw new Error('No workspace is open');
	return workspace;
}
