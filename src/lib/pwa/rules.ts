export type Strategy = 'shell' | 'page' | 'data';

export interface RouteInput {
	method: string;
	mode: string;
	pathname: string;
	scope: string;
	shell: ReadonlySet<string>;
}

export const OFFLINE_HEADER = 'x-pitstop-offline';
export const CACHE_PAGE = 'cache-page';
export const CACHE_PREFIX = 'pitstop-';
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
const NETWORK_ONLY = /^(?:_app\/version\.json$|_app\/remote\/|service-worker\.js$)/;
const PAGE_VERSION = /__sveltekit_\w+\s*=\s*\{[^}]*?\bversion:\s*"([^"]*)"/;

export function shellCache(version: string): string {
	return `${CACHE_PREFIX}shell-${version}`;
}

export function dataCache(version: string): string {
	return `${CACHE_PREFIX}data-${version}`;
}

export function pageCache(version: string): string {
	return `${CACHE_PREFIX}pages-${version}`;
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

export function isOfflinePage(path: string): boolean {
	return isPitPage(path) || isWorkspacePage(path);
}

export function pageToKeep(message: unknown, origin: string, scope: string): string | null {
	if (typeof message !== 'object' || message === null) return null;
	const { type, url } = message as Record<string, unknown>;
	if (type !== CACHE_PAGE || typeof url !== 'string' || !URL.canParse(url)) return null;
	const parsed = new URL(url);
	if (parsed.origin !== origin || !isOfflinePage(relative(parsed.pathname, scope))) return null;
	parsed.hash = '';
	return parsed.href;
}

export function strategyFor(input: RouteInput): Strategy | null {
	if (input.method !== 'GET') return null;
	const path = relative(input.pathname, input.scope);
	if (NETWORK_ONLY.test(path)) return null;
	if (input.shell.has(input.pathname)) return 'shell';
	if (input.mode === 'navigate') {
		return isOfflinePage(path) ? 'page' : null;
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

export function pageVersion(html: string): string | null {
	return PAGE_VERSION.exec(html)?.[1] ?? null;
}

export function isPageFrom(html: string, version: string): boolean {
	return pageVersion(html) === version;
}

export async function acceptPage(response: Response, version: string): Promise<Response | null> {
	const html = await response.text();
	if (!isPageFrom(html, version)) return null;
	return new Response(html, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers
	});
}

export function fallbackDelay(online: boolean, timeout: number): number {
	return online ? timeout : 0;
}

export function firstAnswer<T>(
	network: Promise<T>,
	fallback: () => Promise<T | null>,
	delay: number
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		let settled = false;
		const tryCache = async (error: unknown) => {
			const cached = await fallback().catch(() => null);
			if (settled) return;
			if (cached !== null) {
				settled = true;
				resolve(cached);
			} else if (error !== null) {
				settled = true;
				reject(error);
			}
		};
		const timer = setTimeout(() => void tryCache(null), delay);
		network.then(
			(answer) => {
				clearTimeout(timer);
				if (settled) return;
				settled = true;
				resolve(answer);
			},
			(error: unknown) => {
				clearTimeout(timer);
				void tryCache(error);
			}
		);
	});
}

export function obsoleteCaches(keys: readonly string[], keep: readonly string[]): string[] {
	return keys.filter((key) => key.startsWith(CACHE_PREFIX) && !keep.includes(key));
}

export function overflow<T>(entries: readonly T[], max: number): T[] {
	return entries.slice(0, Math.max(0, entries.length - max));
}

export function isStaleWorker(keys: readonly string[], version: string, pending: boolean): boolean {
	if (pending) return false;
	const ours = keys.filter((key) => key.startsWith(CACHE_PREFIX));
	if (ours.length === 0) return false;
	const shells = ours
		.filter((key) => key.startsWith(shellCache('')))
		.map((key) => key.slice(shellCache('').length));
	return !shells.some((shell) => shell === version || Number(shell) > Number(version));
}
