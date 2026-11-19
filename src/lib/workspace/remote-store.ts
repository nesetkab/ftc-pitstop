import { encodeLoadOptions } from '#lib/workspace/query.ts';
import {
	metaSchema,
	snapshotSchema,
	stampedSchemas,
	type DocMap,
	type DocName,
	type Stamped
} from '#lib/workspace/schemas.ts';
import {
	WorkspaceError,
	hasDocs,
	type LoadOptions,
	type WorkspaceErrorCode,
	type WorkspaceStore,
	type WriteResult
} from '#lib/workspace/types.ts';

export interface RemoteStoreOptions {
	fetch?: typeof fetch;
	base?: string;
	interval?: number;
	isVisible?: () => boolean;
}

const KEEPALIVE_LIMIT = 60_000;

const FAILURES: Record<number, [WorkspaceErrorCode, string]> = {
	400: ['invalid', 'The workspace rejected the request'],
	404: ['not-found', 'No workspace uses this code'],
	413: ['too-large', 'This is too large to save'],
	422: ['invalid', 'The workspace rejected the request'],
	429: ['rate-limited', 'Too many requests. Try again in a minute.']
};

function failure(response: Response): WorkspaceError {
	const [code, message] = FAILURES[response.status] ?? [
		'unavailable',
		'Shared workspaces are unavailable right now'
	];
	return new WorkspaceError(code, message);
}

export function createRemoteStore(options: RemoteStoreOptions = {}): WorkspaceStore {
	const base = options.base ?? '/api/workspace';
	const interval = options.interval ?? 10_000;
	const isVisible =
		options.isVisible ?? (() => typeof document === 'undefined' || !document.hidden);

	async function call(path: string, init?: RequestInit): Promise<Response> {
		const send = options.fetch ?? fetch;
		try {
			return await send(`${base}${path}`, init);
		} catch {
			throw new WorkspaceError('unavailable', 'The shared workspace could not be reached');
		}
	}

	async function body(response: Response): Promise<unknown> {
		try {
			return await response.json();
		} catch {
			throw new WorkspaceError('unavailable', 'The shared workspace sent an unreadable answer');
		}
	}

	const store: WorkspaceStore = {
		kind: 'shared',

		async create({ teamNumber }) {
			const response = await call('', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ teamNumber })
			});
			if (!response.ok) throw failure(response);
			const meta = metaSchema.safeParse(await body(response));
			if (!meta.success)
				throw new WorkspaceError('unavailable', 'The workspace answer was invalid');
			return meta.data;
		},

		async load(code, loadOptions: LoadOptions = {}) {
			const response = await call(`/${code}${encodeLoadOptions(loadOptions)}`);
			if (response.status === 404) return null;
			if (!response.ok) throw failure(response);
			const snapshot = snapshotSchema.safeParse(await body(response));
			if (!snapshot.success) {
				throw new WorkspaceError('unavailable', 'The workspace answer was invalid');
			}
			return snapshot.data;
		},

		async write<K extends DocName>(
			code: string,
			doc: K,
			data: DocMap[K],
			baseVersion?: number | null
		): Promise<WriteResult<K>> {
			const payload = JSON.stringify({ data, base: baseVersion });
			const response = await call(`/${code}/${doc}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: payload,
				keepalive: payload.length < KEEPALIVE_LIMIT
			});
			if (response.status === 409) {
				const current = stampedSchemas[doc].safeParse(await body(response));
				if (!current.success) {
					throw new WorkspaceError('unavailable', 'The workspace answer was invalid');
				}
				return { ok: false, current: current.data as Stamped<DocMap[K]> };
			}
			if (!response.ok) throw failure(response);
			const saved = (await body(response)) as { updatedAt?: unknown };
			if (typeof saved.updatedAt !== 'number') {
				throw new WorkspaceError('unavailable', 'The workspace answer was invalid');
			}
			return { ok: true, stamped: { updatedAt: saved.updatedAt, data } };
		},

		watch(code, request, onChange) {
			if (typeof document === 'undefined') return () => {};
			let stopped = false;
			let timer: ReturnType<typeof setTimeout> | undefined;

			async function tick() {
				if (stopped) return;
				if (isVisible()) {
					const snapshot = await store.load(code, request()).catch(() => null);
					if (!stopped && hasDocs(snapshot)) onChange(snapshot);
				}
				if (!stopped) timer = setTimeout(tick, interval);
			}

			function wake() {
				if (stopped || !isVisible()) return;
				clearTimeout(timer);
				void tick();
			}

			document.addEventListener('visibilitychange', wake);
			window.addEventListener('online', wake);
			timer = setTimeout(tick, interval);
			return () => {
				stopped = true;
				clearTimeout(timer);
				document.removeEventListener('visibilitychange', wake);
				window.removeEventListener('online', wake);
			};
		}
	};
	return store;
}
