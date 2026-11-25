import { describe, expect, it } from 'vitest';
import { hasBuild, pageAssets, readCode } from './bundle.ts';

const NOW = 'pages/(app)/events/_code_/now/_page.svelte.js';
const PIT = 'pages/(bare)/_team_team_/_page.svelte.js';
const TV = 'pages/(bare)/_team_team_/tv/_page.svelte.js';

describe.skipIf(!hasBuild())('live Now and pit page code, read from the last npm run build', () => {
	it('finds the Now and pit pages', () => {
		for (const page of [NOW, PIT, TV]) expect(pageAssets(page).length).toBeGreaterThan(0);
	});

	it('leaves pit screen text out of the Now page', () => {
		expect(readCode(pageAssets(NOW))).not.toContain('next on the field');
		expect(readCode(pageAssets(PIT))).toContain('next on the field');
	});

	it('loads the remote function runtime only for replays', () => {
		for (const page of [NOW, PIT, TV]) {
			expect(readCode(pageAssets(page))).not.toContain('/remote/');
		}
	});
});
