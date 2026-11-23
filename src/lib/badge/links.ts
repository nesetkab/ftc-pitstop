export const BADGE_STATS = ['opr', 'rank', 'region', 'record', 'next'] as const;

export type BadgeStat = (typeof BADGE_STATS)[number];

export type BadgeKind = BadgeStat | 'summary' | 'card';

export type BadgeTheme = 'light' | 'dark';

export const BADGE_KINDS: { kind: BadgeKind; label: string }[] = [
	{ kind: 'summary', label: 'Summary' },
	{ kind: 'card', label: 'Card' },
	{ kind: 'opr', label: 'Season OPR' },
	{ kind: 'rank', label: 'World rank' },
	{ kind: 'region', label: 'Region rank' },
	{ kind: 'record', label: 'Qual record' },
	{ kind: 'next', label: 'Next event' }
];

export function badgeStat(value: string | null): BadgeStat | null {
	return BADGE_STATS.find((stat) => stat === value) ?? null;
}

export function badgeTheme(value: string | null): BadgeTheme {
	return value === 'dark' ? 'dark' : 'light';
}

export function badgeQuery(kind: BadgeKind, theme: BadgeTheme = 'light'): string {
	const params = new URLSearchParams();
	if (kind !== 'summary' && kind !== 'card') params.set('stat', kind);
	if (theme === 'dark') params.set('theme', 'dark');
	return params.size > 0 ? `?${params}` : '';
}

export function badgePath(number: number, kind: BadgeKind, theme: BadgeTheme = 'light'): string {
	const query = badgeQuery(kind, theme);
	const file = kind === 'card' ? `${number}/card.svg` : `${number}.svg`;
	return `/badge/${file}${query}`;
}

export interface BadgeSnippets {
	url: string;
	markdown: string;
	html: string;
}

function attribute(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

export function badgeSnippets(
	origin: string,
	number: number,
	kind: BadgeKind,
	alt: string
): BadgeSnippets {
	const light = `${origin}${badgePath(number, kind)}`;
	const dark = `${origin}${badgePath(number, kind, 'dark')}`;
	const page = `${origin}/teams/${number}`;
	const text = alt.replaceAll(/[[\]]/g, '');
	return {
		url: light,
		markdown: `[![${text}](${light})](${page})`,
		html: [
			`<a href="${attribute(page)}">`,
			'  <picture>',
			`    <source media="(prefers-color-scheme: dark)" srcset="${attribute(dark)}">`,
			`    <img src="${attribute(light)}" alt="${attribute(alt)}">`,
			'  </picture>',
			'</a>'
		].join('\n')
	};
}
