const SITE_NAME = 'PitStop';
const TEAM_PAGE = /^\/(?:teams\/)?([1-9]\d{0,4})(?:\/|$)/;
const MATCH_PAGE = /^\/events\/([A-Za-z0-9]{2,24})\/matches\/([qp]\d{1,3}(?:-\d{1,3})?)\/?$/i;
const EVENT_PAGE = /^\/events\/([A-Za-z0-9]{2,24})(?:\/|$)/;
const WORKSPACE_PAGE = /^\/w(?:\/|$)/;

const PAGE_IMAGES: Record<string, string> = {
	'/events': '/og/events.png',
	'/leaderboards': '/og/leaderboards.png',
	'/records': '/og/records.png',
	'/advancement': '/og/advancement.png',
	'/accuracy': '/og/accuracy.png'
};

const FALLBACK_DESCRIPTIONS: [RegExp, (match: RegExpExecArray) => string][] = [
	[
		/^\/([1-9]\d{0,4})\/tv\/?$/,
		([, team]) =>
			`Pit display for FTC team ${team}: next match, queue time, rankings and results on one screen.`
	],
	[
		/^\/([1-9]\d{0,4})\/?$/,
		([, team]) =>
			`Phone view for FTC team ${team}: when to queue, the next match, partners, opponents and live rankings.`
	],
	[
		WORKSPACE_PAGE,
		() => 'Pick list, strategy board, battery log and checklists shared with your FTC team.'
	]
];

function compareImage(url: URL): string {
	const teams = (url.searchParams.get('teams') ?? '')
		.split(',')
		.filter((part) => /^[1-9]\d{0,4}$/.test(part));
	const unique = [...new Set(teams)].slice(0, 4);
	return unique.length >= 2 ? `/og/compare/${unique.join('-')}.png` : '/og/compare.png';
}

export function ogImagePath(url: URL): string {
	const { pathname } = url;
	const team = TEAM_PAGE.exec(pathname);
	if (team) return `/og/teams/${team[1]}.png`;
	const match = MATCH_PAGE.exec(pathname);
	if (match) return `/og/events/${match[1].toUpperCase()}/matches/${match[2].toLowerCase()}.png`;
	const event = EVENT_PAGE.exec(pathname);
	if (event) return `/og/events/${event[1].toUpperCase()}.png`;
	if (pathname === '/compare') return compareImage(url);
	if (WORKSPACE_PAGE.test(pathname)) return '/og/workspace.png';
	if (pathname.startsWith('/advancement/')) return '/og/advancement.png';
	return PAGE_IMAGES[pathname.replace(/\/$/, '')] ?? '/og/site.png';
}

function quoted(text: string): string {
	return text.replaceAll('"', '&quot;');
}

function fallbackDescription(pathname: string): string | undefined {
	for (const [pattern, describe] of FALLBACK_DESCRIPTIONS) {
		const match = pattern.exec(pathname);
		if (match) return describe(match);
	}
	return undefined;
}

function pageUrl(canonical: string | undefined, url: URL): URL {
	if (!canonical) return url;
	try {
		return new URL(canonical.replaceAll('&amp;', '&'));
	} catch {
		return url;
	}
}

export function withSocialTags(html: string, url: URL): string {
	const head = html.indexOf('</head>');
	if (head === -1 || html.includes('property="og:title"')) return html;
	const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim();
	const found = /<meta name="description" content="([^"]*)"/.exec(html)?.[1];
	const fallback = found ? undefined : fallbackDescription(url.pathname);
	const description = found ?? (fallback ? quoted(fallback) : undefined);
	const canonical = /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1];
	const image = `${url.origin}${ogImagePath(pageUrl(canonical, url))}`;
	const titleText = title ? quoted(title) : undefined;
	const tags: [string, string, string | undefined][] = [
		['name', 'description', fallback ? description : undefined],
		['property', 'og:site_name', SITE_NAME],
		['property', 'og:type', 'website'],
		['property', 'og:url', canonical ?? `${url.origin}${url.pathname}`],
		['property', 'og:title', titleText],
		['property', 'og:description', description],
		['property', 'og:image', image],
		['property', 'og:image:type', 'image/png'],
		['property', 'og:image:width', '1200'],
		['property', 'og:image:height', '630'],
		['property', 'og:image:alt', titleText],
		['name', 'twitter:card', 'summary_large_image'],
		['name', 'twitter:title', titleText],
		['name', 'twitter:description', description],
		['name', 'twitter:image', image],
		['name', 'twitter:image:alt', titleText]
	];
	const markup = tags
		.filter((tag): tag is [string, string, string] => Boolean(tag[2]))
		.map(([kind, name, content]) => `<meta ${kind}="${name}" content="${content}" />`)
		.join('');
	return `${html.slice(0, head)}${markup}${html.slice(head)}`;
}
