import { toSearchResults } from './search-results.ts';
export type SearchResult = {
	type: 'team' | 'event';
	label: string;
	sublabel?: string | null;
	href: string;
};

export type SearchFn = (query: string, signal: AbortSignal) => Promise<SearchResult[]>;

export const searchDialog = $state({ open: false });

export async function searchApi(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
	const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
	if (!response.ok) return [];
	return toSearchResults(await response.json());
}
