import type { MatchListItem } from '#lib/ui/MatchList.svelte';
import type { PitMatch } from './view.ts';

/** Makes every played match in a list open its score breakdown. */
export function pickable(
	items: MatchListItem[],
	matches: PitMatch[],
	open: ((key: string) => void) | undefined
): MatchListItem[] {
	if (!open) return items;
	return items.map((item) => {
		const match = matches.find((entry) => entry.label === item.label && entry.outcome !== null);
		return match ? { ...item, onpick: () => open(match.key) } : item;
	});
}
