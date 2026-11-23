const FIRST_CODE = 32;

const REGULAR = [
	278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
	556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
	611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
	667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
	222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
];

const BOLD = [
	278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
	556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
	611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
	667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
	278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584
];

const SPECIAL: Record<string, number> = {
	'·': 278,
	'…': 1000,
	'–': 556,
	'—': 1000,
	'’': 222,
	'‘': 222,
	'“': 333,
	'”': 333
};

const LATIN_FALLBACK = 667;
const WIDE = 1000;
const WIDE_FROM = 0x2e80;
const SAFETY = 1.04;
const ELLIPSIS = '…';

export interface Font {
	size: number;
	bold?: boolean;
}

function glyphWidth(char: string, bold: boolean): number {
	if (SPECIAL[char] !== undefined) return SPECIAL[char];
	const base = char.normalize('NFD').replace(/\p{M}+/gu, '') || char;
	const code = base.codePointAt(0) ?? 0;
	const table = bold ? BOLD : REGULAR;
	const known = table[code - FIRST_CODE];
	if (base.length === 1 && known !== undefined) return known;
	return code >= WIDE_FROM ? WIDE : LATIN_FALLBACK;
}

export function textWidth(text: string, font: Font): number {
	let units = 0;
	for (const char of text) units += glyphWidth(char, font.bold ?? false);
	return Math.ceil(((units * font.size) / 1000) * SAFETY * 10) / 10;
}

export function fitText(text: string, font: Font, max: number): string {
	if (textWidth(text, font) <= max) return text;
	const chars = [...text];
	let low = 0;
	let high = chars.length;
	while (low < high) {
		const middle = Math.ceil((low + high) / 2);
		const candidate = chars.slice(0, middle).join('').trimEnd() + ELLIPSIS;
		if (textWidth(candidate, font) <= max) low = middle;
		else high = middle - 1;
	}
	return low === 0 ? ELLIPSIS : chars.slice(0, low).join('').trimEnd() + ELLIPSIS;
}
