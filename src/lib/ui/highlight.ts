export type Part = { text: string; hit: boolean };

export function highlight(text: string, query: string): Part[] {
	const needle = query.trim().toLowerCase();
	const haystack = text.toLowerCase();
	const index = needle && haystack.length === text.length ? haystack.indexOf(needle) : -1;
	if (index < 0) return [{ text, hit: false }];
	return [
		{ text: text.slice(0, index), hit: false },
		{ text: text.slice(index, index + needle.length), hit: true },
		{ text: text.slice(index + needle.length), hit: false }
	].filter((part) => part.text);
}
