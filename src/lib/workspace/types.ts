import type { DocMap, DocName, Snapshot, Stamped, WorkspaceMeta } from '#lib/workspace/schemas.ts';

export type WorkspaceKind = 'device' | 'shared' | 'memory';

export type Versions = Partial<Record<DocName, number>>;

export interface LoadOptions {
	known?: Versions;
	docs?: readonly DocName[];
	rev?: string;
	key?: string;
}

export type WriteResult<K extends DocName> =
	{ ok: true; stamped: Stamped<DocMap[K]> } | { ok: false; current: Stamped<DocMap[K]> };

export type WorkspaceErrorCode =
	| 'not-found'
	| 'invalid'
	| 'too-large'
	| 'rate-limited'
	| 'unavailable'
	| 'storage'
	| 'unsupported'
	| 'forbidden';

export type LoadedSnapshot = Snapshot & { proven?: boolean };

export class WorkspaceError extends Error {
	readonly code: WorkspaceErrorCode;

	constructor(code: WorkspaceErrorCode, message: string) {
		super(message);
		this.name = 'WorkspaceError';
		this.code = code;
	}
}

export interface WorkspaceStore {
	readonly kind: WorkspaceKind;
	create(input: { teamNumber: number | null }): Promise<WorkspaceMeta>;
	load(code: string, options?: LoadOptions): Promise<LoadedSnapshot | null>;
	write<K extends DocName>(
		code: string,
		doc: K,
		data: DocMap[K],
		base?: number | null
	): Promise<WriteResult<K>>;
	watch?(
		code: string,
		request: () => LoadOptions,
		onChange: (snapshot: Snapshot) => void
	): () => void;
}

export function hasDocs(snapshot: Snapshot | null): snapshot is Snapshot {
	return snapshot !== null && Object.keys(snapshot.docs).length > 0;
}
