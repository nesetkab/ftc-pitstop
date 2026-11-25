export interface NavLink {
	href: string;
	label: string;
	also?: string[];
}

export const NAV_LINKS: NavLink[] = [
	{ href: '/events', label: 'Events', also: ['/advancement', '/regions'] },
	{ href: '/leaderboards', label: 'Leaderboards' },
	{ href: '/records', label: 'Records' },
	{ href: '/compare', label: 'Compare', also: ['/simulate'] }
];

function within(path: string, base: string) {
	return path === base || path.startsWith(`${base}/`);
}

export function navCurrent(path: string, link: NavLink): 'page' | 'true' | undefined {
	if (path === link.href) return 'page';
	return [link.href, ...(link.also ?? [])].some((base) => within(path, base)) ? 'true' : undefined;
}
