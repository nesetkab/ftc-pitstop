export type Strategy = 'shell' | 'page' | 'data';

export interface RouteInput {
	method: string;
	mode: string;
	pathname: string;
	scope: string;
	shell: ReadonlySet<string>;
}

export const OFFLINE_HEADER = 'x-pitstop-offline';
export const CACHE_PREFIX = 'pitstop-';
export const PAGES_CACHE = `${CACHE_PREFIX}pages`;
export const MAX_DATA_ENTRIES = 40;
export const MAX_PAGE_ENTRIES = 20;
export const PAGE_TIMEOUT = 4_000;
export const DATA_TIMEOUT = 8_000;

const TEAM = '[1-9]\\d{0,4}';
const PIT_PAGE = new RegExp(`^${TEAM}(?:/tv)?/?$`);
const PIT_DATA = new RegExp(`^${TEAM}(?:/tv)?/__data\\.json$`);
const EVENT_DATA = /^api\/events\/[A-Za-z0-9]{2,24}\/(?:lite|analysis)$/;
const WORKSPACE_PAGE =
	/^w(?:\/[A-Za-z0-9-]{1,40}(?:\/(?:picklist|batteries|checklist|board))?)?\/?$/;
const IMMUTABLE_REF = /["'(]([^"'()\s]*_app\/immutable\/[^"'()\s?#]+)/g;

export function shellCache(version: string): string {
	return `${CACHE_PREFIX}shell-${version}`;
}

export function dataCache(version: string): string {
	return `${CACHE_PREFIX}data-${version}`;
}

function relative(pathname: string, scope: string): string {
	return pathname.startsWith(scope) ? pathname.slice(scope.length) : pathname.slice(1);
}

export function isPitPage(path: string): boolean {
	return PIT_PAGE.test(path);
}

export function isWorkspacePage(path: string): boolean {
	return WORKSPACE_PAGE.test(path) && !path.startsWith('w/share');
}

export function strategyFor(input: RouteInput): Strategy | null {
	if (input.method !== 'GET') return null;
	if (input.shell.has(input.pathname)) return 'shell';
	const path = relative(input.pathname, input.scope);
	if (input.mode === 'navigate') {
		return isPitPage(path) || isWorkspacePage(path) ? 'page' : null;
	}
	return EVENT_DATA.test(path) || PIT_DATA.test(path) ? 'data' : null;
}

export function dataKey(url: string): string {
	const parsed = new URL(url);
	return `${parsed.origin}${parsed.pathname}`;
}

export function isCacheableResponse(response: {
	status: number;
	headers: Headers;
	redirected?: boolean;
}): boolean {
	if (response.status !== 200 || response.redirected) return false;
	const control = response.headers.get('cache-control') ?? '';
	return !/\b(no-store|private)\b/i.test(control) && !response.headers.has('set-cookie');
}

export function isImmutable(path: string): boolean {
	return path.includes('/_app/immutable/');
}

export function pageAssets(html: string, page: string): string[] {
	const origin = new URL(page).origin;
	const found = new Set<string>();
	for (const match of html.matchAll(IMMUTABLE_REF)) {
		try {
			const url = new URL(match[1], page);
			if (url.origin === origin) found.add(url.pathname);
		} catch {
			continue;
		}
	}
	return [...found];
}

export function pageFits(html: string, page: string, shell: ReadonlySet<string>): boolean {
	const assets = pageAssets(html, page);
	return assets.length > 0 && assets.every((path) => shell.has(path));
}

export function obsoleteCaches(keys: readonly string[], keep: readonly string[]): string[] {
	return keys.filter((key) => key.startsWith(CACHE_PREFIX) && !keep.includes(key));
}

export function overflow<T>(entries: readonly T[], max: number): T[] {
	return entries.slice(0, Math.max(0, entries.length - max));
}
