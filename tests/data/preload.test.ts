import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('link preloading', () => {
	it('loads page data on tap so hovers make no server requests', () => {
		const html = readFileSync('src/app.html', 'utf8');
		expect(html).toContain('data-sveltekit-preload-data="tap"');
		expect(html).toContain('data-sveltekit-preload-code="hover"');
		expect(html).not.toContain('data-sveltekit-preload-data="hover"');
	});
});
