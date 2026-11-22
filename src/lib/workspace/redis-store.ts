import * as z from 'zod/mini';
import { generateCode, type RandomBytes } from '#lib/workspace/code.ts';
import type { LimiterRedis } from '#lib/workspace/limit.ts';
import {
	DOC_NAMES,
	metaSchema,
	putDoc,
	stampedSchemas,
	type DocMap,
	type DocName,
	type Docs,
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
	picklist: 48_000,
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
	cacheTtl?: number;
	cacheSize?: number;
}

const storedMetaSchema = z.extend(metaSchema, {
	rev: z.optional(z.string()),
	key: z.optional(z.string())
});

type StoredMeta = WorkspaceMeta & { rev: string; key: string };

interface Entry {
	meta: StoredMeta;
	checkedAt: number;
	docs: Docs;
	loaded: Set<DocName>;
}

function decode(raw: unknown): unknown {
	if (typeof raw !== 'string') return raw ?? null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function token(): string {
	return crypto.randomUUID().replaceAll('-', '');
}

function publicMeta({ code, teamNumber, createdAt }: WorkspaceMeta): WorkspaceMeta {
	return { code, teamNumber, createdAt };
}

export function createRedisStore(
	redis: WorkspaceRedis,
	options: RedisStoreOptions = {}
): WorkspaceStore {
	const prefix = options.prefix ?? 'pitstop:ws:';
	const ttl = options.ttl ?? WORKSPACE_TTL_SECONDS;
	const now = options.now ?? Date.now;
	const cacheTtl = options.cacheTtl ?? 4_000;
	const cacheSize = options.cacheSize ?? 100;
	const cache = new Map<string, Entry>();
	const metaKey = (code: string) => `${prefix}${code}:meta`;
	const docKey = (code: string, name: DocName) => `${prefix}${code}:${name}`;

	function parseMeta(raw: unknown) {
		const result = storedMetaSchema.safeParse(decode(raw));
		return result.success ? result.data : null;
	}

	function parseStamped<K extends DocName>(name: K, raw: unknown): Stamped<DocMap[K]> | null {
		const result = stampedSchemas[name].safeParse(decode(raw));
		return result.success ? (result.data as Stamped<DocMap[K]>) : null;
	}

	function remember(code: string, entry: Entry): Entry {
		cache.delete(code);
		cache.set(code, entry);
		if (cache.size > cacheSize) cache.delete(cache.keys().next().value as string);
		return entry;
	}

	async function saveMeta(
		code: string,
		meta: WorkspaceMeta & { key?: string }
	): Promise<StoredMeta> {
		const stored = { ...publicMeta(meta), rev: token(), key: meta.key ?? token() };
		await redis.set(metaKey(code), JSON.stringify(stored), { ex: ttl });
		return stored;
	}

	async function refresh(code: string, names: readonly DocName[]): Promise<Entry | null> {
		const [rawMeta, ...rawDocs] =
			names.length > 0
				? await redis.mget(metaKey(code), ...names.map((name) => docKey(code, name)))
				: [await redis.get(metaKey(code))];
		const meta = parseMeta(rawMeta);
		if (!meta) {
			cache.delete(code);
			return null;
		}
		const entry: Entry = {
			meta: meta as StoredMeta,
			checkedAt: now(),
			docs: {},
			loaded: new Set()
		};
		if (!meta.rev || !meta.key) {
			entry.meta = await saveMeta(code, meta);
			return remember(code, entry);
		}
		const previous = cache.get(code);
		if (previous?.meta.rev === meta.rev) {
			entry.docs = { ...previous.docs };
			entry.loaded = new Set(previous.loaded);
		}
		names.forEach((name, index) => {
			const stamped = parseStamped(name, rawDocs[index]);
			if (stamped) putDoc(entry.docs, name, stamped);
			else delete entry.docs[name];
			entry.loaded.add(name);
		});
		return remember(code, entry);
	}

	return {
		kind: 'shared',

		async create({ teamNumber }) {
			for (let attempt = 0; attempt < 12; attempt++) {
				const code = generateCode(options.random);
				const meta: StoredMeta = {
					code,
					teamNumber,
					createdAt: now(),
					rev: token(),
					key: token()
				};
				const stored = await redis.set(metaKey(code), JSON.stringify(meta), { nx: true, ex: ttl });
				if (stored === 'OK') {
					remember(code, { meta, checkedAt: now(), docs: {}, loaded: new Set(DOC_NAMES) });
					return publicMeta(meta);
				}
			}
			throw new WorkspaceError('unavailable', 'No free join code was found');
		},

		async load(code, loadOptions: LoadOptions = {}) {
			const names = loadOptions.docs ?? DOC_NAMES;
			const { rev, known, key } = loadOptions;
			const cached = cache.get(code);
			const usable = cached !== undefined && now() - cached.checkedAt < cacheTtl;
			const entry = usable ? cached : await refresh(code, rev === undefined ? names : []);
			if (!entry) return null;
			const meta = publicMeta(entry.meta);
			const owned = { rev: entry.meta.rev, key: entry.meta.key };
			if (rev === entry.meta.rev) return { meta, docs: {}, ...owned, proven: true };
			const missing = names.filter((name) => !entry.loaded.has(name));
			if (missing.length > 0) {
				const raws = await redis.mget(...missing.map((name) => docKey(code, name)));
				missing.forEach((name, index) => {
					const stamped = parseStamped(name, raws[index]);
					if (stamped) putDoc(entry.docs, name, stamped);
					entry.loaded.add(name);
				});
			}
			const docs: Docs = {};
			let proven = key === entry.meta.key;
			for (const name of names) {
				const stamped = entry.docs[name];
				if (!stamped) continue;
				const version = known?.[name];
				if (version === stamped.updatedAt) proven = true;
				if (version === undefined || version < stamped.updatedAt) putDoc(docs, name, stamped);
			}
			return { meta, docs, ...owned, proven };
		},

		async write<K extends DocName>(
			code: string,
			doc: K,
			data: DocMap[K],
			base?: number | null
		): Promise<WriteResult<K>> {
			const [rawMeta, rawCurrent] = await redis.mget(metaKey(code), docKey(code, doc));
			const stored = parseMeta(rawMeta);
			if (!stored) {
				cache.delete(code);
				throw new WorkspaceError('not-found', 'No workspace uses this code');
			}
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
			const meta = await saveMeta(code, stored);
			const docs: Docs = {};
			putDoc(docs, doc, stamped);
			remember(code, { meta, checkedAt: now(), docs, loaded: new Set([doc]) });
			return { ok: true, stamped };
		}
	};
}
