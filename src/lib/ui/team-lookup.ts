import { searchApi } from '#lib/ui/search-results.ts';
import type { SearchFn, SearchResult } from '#lib/ui/search.svelte.ts';

export const MAX_HITS = 4;
const MEMO_SIZE = 60;

export interface TeamHit {
	number: number;
	name: string;
	place: string | null;
}

export type TeamLookup = (query: string, signal: AbortSignal) => Promise<TeamHit[]>;

export function teamHits(results: readonly SearchResult[]): TeamHit[] {
	return results
		.flatMap((result) => {
			const match = result.type === 'team' ? /^\/teams\/(\d{1,6})$/.exec(result.href) : null;
			if (!match) return [];
			const number = Number(match[1]);
			const name = result.label.replace(new RegExp(`^${number}\\s*`), '');
			return [{ number, name, place: result.sublabel ?? null }];
		})
		.slice(0, MAX_HITS);
}

export function isNumberEntry(text: string): boolean {
	return /^[\d\s,]*$/.test(text);
}

export function needsLookup(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed) return false;
	return !isNumberEntry(trimmed) || /^\d+$/.test(trimmed);
}

function memoKey(query: string): string {
	return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function createLookup(search: SearchFn): TeamLookup {
	const memo = new Map<string, TeamHit[]>();
	return async (query, signal) => {
		const key = memoKey(query);
		const known = memo.get(key);
		if (known) return known;
		const hits = teamHits(await search(query.trim(), signal));
		if (hits.length === 0) return hits;
		memo.set(key, hits);
		for (const oldest of memo.keys()) {
			if (memo.size <= MEMO_SIZE) break;
			memo.delete(oldest);
		}
		return hits;
	};
}

const lookups = new WeakMap<SearchFn, TeamLookup>();

export function teamLookup(search: SearchFn = searchApi): TeamLookup {
	let lookup = lookups.get(search);
	if (!lookup) {
		lookup = createLookup(search);
		lookups.set(search, lookup);
	}
	return lookup;
}
