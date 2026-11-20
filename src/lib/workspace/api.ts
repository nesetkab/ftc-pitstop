import { z } from 'zod';
import { describeError } from '#lib/server/errors.ts';
import { CACHE_CONTROL, jsonResponse } from '#lib/server/http.ts';
import { isCode } from '#lib/workspace/code.ts';
import type { Limiter } from '#lib/workspace/limit.ts';
import { parseLoadOptions } from '#lib/workspace/query.ts';
import { DOC_BYTE_LIMITS } from '#lib/workspace/redis-store.ts';
import { DOC_NAMES, parseDoc, type DocName } from '#lib/workspace/schemas.ts';
import { WorkspaceError, type WorkspaceStore } from '#lib/workspace/types.ts';

export const RATE = {
	create: { limit: 40, window: 3600 },
	write: { limit: 90, window: 60 },
	miss: { limit: 30, window: 600 }
} as const;

const createBody = z.object({
	teamNumber: z.number().int().min(1).max(999_999).nullable()
});

const writeBody = z.object({
	data: z.unknown(),
	base: z.number().int().nonnegative().nullable().optional()
});

export interface WorkspaceApi {
	create(request: Request, ip: string): Promise<Response>;
	load(request: Request, code: string, ip: string): Promise<Response>;
	write(request: Request, code: string, doc: string): Promise<Response>;
}

const STATUS: Record<WorkspaceError['code'], number> = {
	'not-found': 404,
	invalid: 400,
	'too-large': 413,
	'rate-limited': 429,
	unavailable: 503,
	storage: 503
};

function reply(body: unknown, status = 200): Response {
	return jsonResponse(body, CACHE_CONTROL.none, status);
}

function rateLimited(): Response {
	return Response.json(
		{ error: 'Too many requests. Try again in a minute.' },
		{ status: 429, headers: { 'cache-control': CACHE_CONTROL.none, 'retry-after': '60' } }
	);
}

function failure(error: unknown): Response {
	if (error instanceof WorkspaceError) {
		return error.code === 'rate-limited'
			? rateLimited()
			: reply({ error: error.message }, STATUS[error.code]);
	}
	console.error(`workspace request failed: ${describeError(error)}`);
	return reply({ error: 'Workspaces are unavailable right now' }, 503);
}

async function readJson(request: Request, maxLength: number): Promise<unknown> {
	const text = await request.text();
	if (text.length > maxLength) throw new WorkspaceError('too-large', 'This is too large to save');
	try {
		return JSON.parse(text);
	} catch {
		throw new WorkspaceError('invalid', 'The request is not valid JSON');
	}
}

function isDocName(value: string): value is DocName {
	return (DOC_NAMES as readonly string[]).includes(value);
}

export function createWorkspaceApi(store: WorkspaceStore, limiter: Limiter): WorkspaceApi {
	return {
		async create(request, ip) {
			try {
				if (!(await limiter.allow(`create:${ip}`, RATE.create.limit, RATE.create.window))) {
					return rateLimited();
				}
				const body = createBody.safeParse(await readJson(request, 1_000));
				if (!body.success) throw new WorkspaceError('invalid', 'Enter a team number');
				return reply(await store.create(body.data), 201);
			} catch (error) {
				return failure(error);
			}
		},

		async load(request, code, ip) {
			try {
				if (!isCode(code)) throw new WorkspaceError('not-found', 'No workspace uses this code');
				const options = parseLoadOptions(new URL(request.url).searchParams);
				const opening = options.known === undefined;
				if (opening && (await limiter.used(`miss:${ip}`, RATE.miss.window)) >= RATE.miss.limit) {
					return rateLimited();
				}
				const snapshot = await store.load(code, options);
				if (!snapshot) {
					if (opening) await limiter.allow(`miss:${ip}`, RATE.miss.limit, RATE.miss.window);
					throw new WorkspaceError('not-found', 'No workspace uses this code');
				}
				return reply(snapshot);
			} catch (error) {
				return failure(error);
			}
		},

		async write(request, code, doc) {
			try {
				if (!isCode(code) || !isDocName(doc)) {
					throw new WorkspaceError('not-found', 'No workspace uses this code');
				}
				if (!(await limiter.allow(`write:${code}`, RATE.write.limit, RATE.write.window))) {
					return rateLimited();
				}
				const body = writeBody.safeParse(await readJson(request, DOC_BYTE_LIMITS[doc] + 1_000));
				if (!body.success) throw new WorkspaceError('invalid', 'The request is not valid');
				const data = parseDoc(doc, body.data.data);
				if (!data) throw new WorkspaceError('invalid', 'The data is not valid');
				const result = await store.write(code, doc, data, body.data.base);
				return result.ok
					? reply({ updatedAt: result.stamped.updatedAt })
					: reply(result.current, 409);
			} catch (error) {
				return failure(error);
			}
		}
	};
}
