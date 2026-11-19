import { generateCode, type RandomBytes } from '#lib/workspace/code.ts';
import type { LimiterRedis } from '#lib/workspace/limit.ts';
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
	type LoadOptions,
	type WorkspaceStore,
	type WriteResult
} from '#lib/workspace/types.ts';

export interface WorkspaceRedis extends LimiterRedis {
	mget(...keys: string[]): Promise<unknown[]>;
	set(key: string, value: string, options?: { ex?: number; nx?: boolean }): Promise<unknown>;
}

export const DOC_BYTE_LIMITS: Record<DocName, number> = {
	picklist: 40_000,
	batteries: 40_000,
	checklist: 60_000,
	boards: 300_000
};

export const WORKSPACE_TTL_SECONDS = 400 * 86_400;

export interface RedisStoreOptions {
	prefix?: string;
	ttl?: number;
	now?: () => number;
	random?: RandomBytes;
}

function decode(raw: unknown): unknown {
	if (typeof raw !== 'string') return raw ?? null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function createRedisStore(
	redis: WorkspaceRedis,
	options: RedisStoreOptions = {}
): WorkspaceStore {
	const prefix = options.prefix ?? 'pitstop:ws:';
	const ttl = options.ttl ?? WORKSPACE_TTL_SECONDS;
	const now = options.now ?? Date.now;
	const metaKey = (code: string) => `${prefix}${code}:meta`;
	const docKey = (code: string, name: DocName) => `${prefix}${code}:${name}`;

	function parseMeta(raw: unknown): WorkspaceMeta | null {
		const result = metaSchema.safeParse(decode(raw));
		return result.success ? result.data : null;
	}

	function parseStamped<K extends DocName>(name: K, raw: unknown): Stamped<DocMap[K]> | null {
		const result = stampedSchemas[name].safeParse(decode(raw));
		return result.success ? (result.data as Stamped<DocMap[K]>) : null;
	}

	return {
		kind: 'shared',

		async create({ teamNumber }) {
			for (let attempt = 0; attempt < 12; attempt++) {
				const code = generateCode(options.random);
				const meta: WorkspaceMeta = { code, teamNumber, createdAt: now() };
				const stored = await redis.set(metaKey(code), JSON.stringify(meta), { nx: true, ex: ttl });
				if (stored === 'OK') return meta;
			}
			throw new WorkspaceError('unavailable', 'No free join code was found');
		},

		async load(code, loadOptions: LoadOptions = {}) {
			const names = loadOptions.docs ?? DOC_NAMES;
			const [rawMeta, ...rawDocs] = await redis.mget(
				metaKey(code),
				...names.map((name) => docKey(code, name))
			);
			const meta = parseMeta(rawMeta);
			if (!meta) return null;
			const snapshot: Snapshot = { meta, docs: {} };
			names.forEach((name, index) => {
				const stamped = parseStamped(name, rawDocs[index]);
				if (!stamped || loadOptions.known?.[name] === stamped.updatedAt) return;
				putDoc(snapshot.docs, name, stamped);
			});
			return snapshot;
		},

		async write<K extends DocName>(
			code: string,
			doc: K,
			data: DocMap[K],
			base?: number | null
		): Promise<WriteResult<K>> {
			const [rawMeta, rawCurrent] = await redis.mget(metaKey(code), docKey(code, doc));
			if (!parseMeta(rawMeta)) throw new WorkspaceError('not-found', 'No workspace uses this code');
			const current = parseStamped(doc, rawCurrent);
			if (base !== undefined && current && current.updatedAt !== base) {
				return { ok: false, current };
			}
			const stamped: Stamped<DocMap[K]> = {
				updatedAt: Math.max(now(), (current?.updatedAt ?? 0) + 1),
				data
			};
			const payload = JSON.stringify(stamped);
			if (payload.length > DOC_BYTE_LIMITS[doc]) {
				throw new WorkspaceError('too-large', 'This is too large to save');
			}
			await redis.set(docKey(code, doc), payload, { ex: ttl });
			await redis.expire(metaKey(code), ttl);
			return { ok: true, stamped };
		}
	};
}
