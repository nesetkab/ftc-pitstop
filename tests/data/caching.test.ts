import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routes = import.meta.glob('/src/routes/**/+{page,layout}{,.server}.ts', {
	query: '?raw',
	import: 'default',
	eager: true
});

describe('page caching', () => {
	it('uses the free CDN cache instead of paid ISR writes', () => {
		expect(Object.keys(routes).length).toBeGreaterThan(5);
		for (const [file, source] of Object.entries(routes)) {
			expect(String(source), file).not.toMatch(/\bisr\b/);
		}
		expect(readFileSync('vite.config.ts', 'utf8')).not.toMatch(/\bisr\b/);
	});
});
