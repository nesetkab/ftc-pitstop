import { loadAdvancement } from '#lib/server/advancement.ts';
import { settleWithin } from '#lib/server/cache.ts';
import { searchIndex } from '#lib/server/event.ts';
import type { RequestHandler } from './$types';

const PAGES = [
	'/',
	'/events',
	'/events/strength',
	'/leaderboards',
	'/records',
	'/advancement',
	'/accuracy',
	'/about'
];

type Page = { path: string; lastmod?: string };

function escapeXml(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export const GET: RequestHandler = async ({ url }) => {
	const [index, advancement] = await Promise.all([
		searchIndex().catch(() => null),
		settleWithin(loadAdvancement(), 3000)
	]);
	const today = new Date().toISOString().slice(0, 10);
	const pages: Page[] = [
		...PAGES.map((path) => ({ path })),
		...(index?.events ?? []).map((event) => ({
			path: `/events/${event.code}`,
			lastmod: event.end < today ? event.end : undefined
		})),
		...(index?.teams ?? []).map((team) => ({ path: `/teams/${team.number}` })),
		...(advancement?.index.championships ?? []).map((championship) => ({
			path: `/advancement/${championship.code}`
		}))
	];
	const entries = pages.map(({ path, lastmod }) => {
		const loc = `<loc>${escapeXml(url.origin + path)}</loc>`;
		return `<url>${loc}${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
	});
	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...entries,
		'</urlset>',
		''
	].join('\n');
	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': index
				? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
				: 'public, s-maxage=300'
		}
	});
};
