const SITE_NAME = 'PitStop';
const TEAM_PAGE = /^\/(?:teams\/)?([1-9]\d{0,4})(?:\/|$)/;
const EVENT_PAGE = /^\/events\/([A-Za-z0-9]{2,24})(?:\/|$)/;

export function ogImagePath(pathname: string): string {
	const team = TEAM_PAGE.exec(pathname);
	if (team) return `/og/teams/${team[1]}.png`;
	const event = EVENT_PAGE.exec(pathname);
	if (event) return `/og/events/${event[1].toUpperCase()}.png`;
	return '/og/site.png';
}

function quoted(text: string): string {
	return text.replaceAll('"', '&quot;');
}

export function withSocialTags(html: string, url: URL): string {
	const head = html.indexOf('</head>');
	if (head === -1 || html.includes('property="og:title"')) return html;
	const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim();
	const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1];
	const image = `${url.origin}${ogImagePath(url.pathname)}`;
	const tags: [string, string, string | undefined][] = [
		['property', 'og:site_name', SITE_NAME],
		['property', 'og:type', 'website'],
		['property', 'og:url', `${url.origin}${url.pathname}`],
		['property', 'og:title', title ? quoted(title) : undefined],
		['property', 'og:description', description],
		['property', 'og:image', image],
		['property', 'og:image:width', '1200'],
		['property', 'og:image:height', '630'],
		['name', 'twitter:card', 'summary_large_image'],
		['name', 'twitter:image', image]
	];
	const markup = tags
		.filter((tag): tag is [string, string, string] => Boolean(tag[2]))
		.map(([kind, name, content]) => `<meta ${kind}="${name}" content="${content}" />`)
		.join('');
	return `${html.slice(0, head)}${markup}${html.slice(head)}`;
}
