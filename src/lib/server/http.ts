import { DataError } from '#lib/server/errors.ts';

export const CACHE_CONTROL = {
	live: 'public, s-maxage=30, stale-while-revalidate=300',
	finished: 'public, s-maxage=86400',
	list: 'public, s-maxage=3600, stale-while-revalidate=86400',
	short: 'public, s-maxage=300, stale-while-revalidate=3600',
	queue: 'public, s-maxage=10, stale-while-revalidate=30',
	missing: 'public, s-maxage=60',
	none: 'no-store'
} as const;

export function jsonResponse(body: unknown, cacheControl: string, status = 200): Response {
	return Response.json(body, { status, headers: { 'cache-control': cacheControl } });
}

export function errorResponse(error: unknown, fallback: string): Response {
	if (error instanceof DataError) {
		const cacheControl = error.status === 404 ? CACHE_CONTROL.missing : CACHE_CONTROL.none;
		return jsonResponse({ error: error.message }, cacheControl, error.status);
	}
	console.error(
		`${fallback}: ${error instanceof Error ? `${error.name} ${error.message}` : 'unknown error'}`
	);
	return jsonResponse({ error: fallback }, CACHE_CONTROL.none, 503);
}
