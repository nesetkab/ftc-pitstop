import { describe, expect, it } from 'vitest';
import { gzipBytes, hasBuild, readCode, sharedAssets } from './bundle.ts';

const JS_BUDGET = 60_000;
const CSS_BUDGET = 6_800;

describe.skipIf(!hasBuild())('shared bundle budget, read from the last npm run build', () => {
	const shared = sharedAssets();

	it('finds the client entry and both shared layouts', () => {
		expect(shared.layouts).toHaveLength(2);
		expect(shared.js.some((file) => file.includes('/entry/start.'))).toBe(true);
		expect(shared.css.length).toBeGreaterThan(0);
	});

	it(`keeps JavaScript every page loads under ${JS_BUDGET / 1000} kB gzipped`, () => {
		expect(gzipBytes(shared.js)).toBeLessThanOrEqual(JS_BUDGET);
	});

	it(`keeps CSS every page loads under ${CSS_BUDGET / 1000} kB gzipped`, () => {
		expect(gzipBytes(shared.css)).toBeLessThanOrEqual(CSS_BUDGET);
	});

	it('leaves zod and the search dialog out of the code every page loads', () => {
		const code = readCode(shared.js);
		expect(code).toContain('sveltekit');
		expect(code).not.toContain('_zod');
		expect(code).not.toContain('ps-recent-search');
	});
});
