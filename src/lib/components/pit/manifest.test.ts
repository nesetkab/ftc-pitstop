import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { strategyFor } from '#lib/pwa/rules.ts';
import { ICONS, teamManifest } from './manifest.ts';

describe('teamManifest', () => {
	const manifest = teamManifest(724);

	it('opens the pit screen for the team it was installed from', () => {
		expect(manifest.name).toBe('PitStop 724');
		expect(manifest.start_url).toBe('/724');
		expect(manifest.id).toBe('/724');
		expect(manifest.display).toBe('standalone');
		expect(manifest.shortcuts[0].url).toBe('/724/tv');
	});

	it('starts on pages the service worker keeps for offline use', () => {
		for (const url of [manifest.start_url, ...manifest.shortcuts.map((entry) => entry.url)]) {
			const route = strategyFor({
				method: 'GET',
				mode: 'navigate',
				pathname: url,
				scope: '/',
				shell: new Set()
			});
			expect(route).toBe('page');
		}
	});

	it('points at icons that exist, including the sizes installs need', () => {
		for (const icon of ICONS) {
			expect(existsSync(new URL(`../../../../static${icon.src}`, import.meta.url))).toBe(true);
		}
		const sizes = ICONS.filter((icon) => icon.type === 'image/png').map((icon) => icon.sizes);
		expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
		expect(ICONS.some((icon) => icon.purpose === 'maskable')).toBe(true);
	});
});
