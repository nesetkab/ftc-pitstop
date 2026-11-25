export type SearchResult = {
	type: 'team' | 'event';
	label: string;
	sublabel?: string | null;
	meta?: string | null;
	aside?: string | null;
	live?: boolean;
	href: string;
};

export type SearchFn = (query: string, signal: AbortSignal) => Promise<SearchResult[]>;

export const searchDialog = $state({ open: false });

export const TEXT_ENTRY =
	'textarea, select, [contenteditable]:not([contenteditable="false"]), input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="color"])';

export function isTextEntry(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest(TEXT_ENTRY) !== null;
}

export function searchShortcut(event: KeyboardEvent): 'command' | 'slash' | null {
	if (event.defaultPrevented || event.isComposing) return null;
	if (
		(event.metaKey || event.ctrlKey) &&
		!event.altKey &&
		!event.shiftKey &&
		event.key.toLowerCase() === 'k'
	) {
		return 'command';
	}
	if (
		event.key === '/' &&
		!event.metaKey &&
		!event.ctrlKey &&
		!event.altKey &&
		!isTextEntry(event.target)
	) {
		return 'slash';
	}
	return null;
}
