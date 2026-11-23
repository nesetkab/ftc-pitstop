import { CACHE_CONTROL } from '#lib/server/http.ts';

export const ENDPOINT_QUERY: Readonly<Record<string, readonly string[]>> = {
	'/og/[...path]': [],
	'/sitemap.xml': [],
	'/api/events': [],
	'/api/today': [],
	'/api/ratings': [],
	'/api/search': ['q', 'limit'],
	'/api/events/[code]': [],
	'/api/events/[code]/lite': [],
	'/api/events/[code]/analysis': ['v'],
	'/api/nexus/[code]': [],
	'/api/teams/[number]': [],
	'/api/teams/[number]/history': [],
	'/(app)/events/season.json': [],
	'/(app)/events/[code]/calendar.ics': [],
	'/(app)/teams/[number]/calendar.ics': [],
	'/(bare)/[team=team]/manifest.webmanifest': []
};

const READS = new Set(['GET', 'HEAD']);

function keyOf(segment: string): string {
	const raw = segment.split('=')[0].replaceAll('+', ' ');
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}

function sitePath(pathname: string): string {
	return pathname.replace(/^\/+/, '/');
}

export function withoutStrayQuery(url: URL, allowed: readonly string[]): string | null {
	if (!url.search) return null;
	const segments = url.search.slice(1).split('&');
	const seen = new Set<string>();
	const kept = segments.filter((segment) => {
		const key = keyOf(segment);
		if (!segment || !allowed.includes(key) || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	if (kept.length === segments.length) return null;
	const path = sitePath(url.pathname);
	return kept.length > 0 ? `${path}?${kept.join('&')}` : path;
}

export function movedTo(location: string): Response {
	return new Response(null, {
		status: 308,
		headers: { location, 'cache-control': CACHE_CONTROL.list }
	});
}

export function strayQueryRedirect(
	method: string,
	routeId: string | null,
	url: URL
): Response | null {
	if (!READS.has(method) || routeId === null) return null;
	const allowed = ENDPOINT_QUERY[routeId];
	if (!allowed) return null;
	const target = withoutStrayQuery(url, allowed);
	return target ? movedTo(target) : null;
}

export function canonicalRedirect(url: URL, search: string): Response | null {
	if (url.search === search) return null;
	return movedTo(`${sitePath(url.pathname)}${search}`);
}
