export const ICONS = [
	{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
	{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
	{ src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
	{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
];

export function teamManifest(team: number) {
	return {
		name: `PitStop ${team}`,
		short_name: 'PitStop',
		description: `Next match, queue time and alerts for team ${team}.`,
		id: `/${team}`,
		start_url: `/${team}`,
		scope: '/',
		display: 'standalone',
		background_color: '#131313',
		theme_color: '#131313',
		icons: ICONS
	};
}
