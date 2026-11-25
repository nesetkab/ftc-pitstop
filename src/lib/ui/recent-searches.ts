import type { SearchResult } from './search.svelte.ts';

export const RECENT_KEY = 'ps-recent-search';
export const RECENT_LIMIT = 6;

function isRecent(value: unknown): value is SearchResult {
	if (typeof value !== 'object' || value === null) return false;
	const entry = value as Record<string, unknown>;
	return (
		(entry.type === 'team' || entry.type === 'event') &&
		typeof entry.label === 'string' &&
		typeof entry.href === 'string' &&
		/^\/(teams|events)\/[A-Za-z0-9]+$/.test(entry.href) &&
		(entry.sublabel == null || typeof entry.sublabel === 'string') &&
		(entry.aside == null || typeof entry.aside === 'string')
	);
}

function stored(result: SearchResult): SearchResult {
	const aside = result.live ? null : result.aside;
	return {
		type: result.type,
		label: result.label,
		sublabel: result.sublabel ?? null,
		...(aside ? { aside } : {}),
		href: result.href
	};
}

export function parseRecent(raw: string | null): SearchResult[] {
	if (!raw) return [];
	try {
		const value: unknown = JSON.parse(raw);
		return Array.isArray(value) ? value.filter(isRecent).map(stored).slice(0, RECENT_LIMIT) : [];
	} catch {
		return [];
	}
}

export function readRecent(): SearchResult[] {
	try {
		return parseRecent(localStorage.getItem(RECENT_KEY));
	} catch {
		return [];
	}
}

function writeRecent(list: SearchResult[]) {
	try {
		if (list.length === 0) localStorage.removeItem(RECENT_KEY);
		else localStorage.setItem(RECENT_KEY, JSON.stringify(list));
	} catch {
		return;
	}
}

export function withRecent(list: SearchResult[], result: SearchResult): SearchResult[] {
	return [stored(result), ...list.filter((entry) => entry.href !== result.href)].slice(
		0,
		RECENT_LIMIT
	);
}

export function rememberRecent(result: SearchResult): SearchResult[] {
	if (!isRecent(result)) return readRecent();
	const next = withRecent(readRecent(), result);
	writeRecent(next);
	return next;
}

export function clearRecent(): SearchResult[] {
	writeRecent([]);
	return [];
}
