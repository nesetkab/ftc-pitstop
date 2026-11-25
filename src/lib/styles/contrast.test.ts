import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync('src/lib/styles/tokens.css', 'utf8');
const pitLink = readFileSync('src/lib/components/team/PitDisplayLink.svelte', 'utf8');

function lightTokens() {
	const block = tokens.slice(tokens.indexOf(':root,'), tokens.indexOf('}'));
	return Object.fromEntries(
		[...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(([, name, value]) => [name, value])
	);
}

function luminance(hex: string) {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

describe('light mode contrast', () => {
	const light = lightTokens();

	it('keeps green text readable on the page and on panels', () => {
		expect(contrast(light.ok, light.bg)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(light.ok, light.surface)).toBeGreaterThanOrEqual(4.5);
	});

	it('keeps the disabled pit display button readable', () => {
		const rule = pitLink.match(/#pit :global\(\.btn:disabled\) \{([^}]*)\}/)?.[1] ?? '';
		const color = rule.match(/[^-]color: var\(--([\w-]+)\)/)?.[1] ?? '';
		const background = rule.match(/background: var\(--([\w-]+)\)/)?.[1] ?? '';
		expect(rule).toMatch(/opacity: 1;/);
		expect(contrast(light[color], light[background])).toBeGreaterThanOrEqual(4.5);
	});
});
