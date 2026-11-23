import type { SearchResult } from '#lib/ui/search.svelte.ts';

export const MAX_HITS = 4;

export interface TeamHit {
	number: number;
	name: string;
	place: string | null;
}

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
