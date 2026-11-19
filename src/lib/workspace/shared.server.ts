import { CACHE_CONTROL, jsonResponse } from '#lib/server/http.ts';
import { getRedis } from '#lib/server/redis.ts';
import { createWorkspaceApi, type WorkspaceApi } from '#lib/workspace/api.ts';
import { createLimiter } from '#lib/workspace/limit.ts';
import { createRedisStore } from '#lib/workspace/redis-store.ts';

let api: WorkspaceApi | null | undefined;

export function workspaceApi(): WorkspaceApi | null {
	if (api === undefined) {
		const redis = getRedis();
		api = redis ? createWorkspaceApi(createRedisStore(redis), createLimiter(redis)) : null;
	}
	return api;
}

export function sharedWorkspaces(): boolean {
	return workspaceApi() !== null;
}

export function notShared(): Response {
	return jsonResponse({ error: 'Shared workspaces are not turned on' }, CACHE_CONTROL.none, 404);
}

export function clientAddress(getClientAddress: () => string): string {
	try {
		return getClientAddress();
	} catch {
		return 'unknown';
	}
}
