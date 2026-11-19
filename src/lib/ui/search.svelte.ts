export type SearchResult = {
	type: 'team' | 'event';
	label: string;
	sublabel?: string | null;
	href: string;
};

export type SearchFn = (query: string, signal: AbortSignal) => Promise<SearchResult[]>;

export const searchDialog = $state({ open: false });

function isResult(value: unknown): value is SearchResult {
	if (typeof value !== 'object' || value === null) return false;
	const item = value as Record<string, unknown>;
	return (
		(item.type === 'team' || item.type === 'event') &&
		typeof item.label === 'string' &&
		typeof item.href === 'string' &&
		(item.sublabel == null || typeof item.sublabel === 'string')
	);
}

export async function searchApi(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
	const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
	if (!response.ok) return [];
	const body: unknown = await response.json();
	const list = Array.isArray(body) ? body : (body as { results?: unknown } | null)?.results;
	return Array.isArray(list) ? list.filter(isResult) : [];
}
