import { searchIndex } from '#lib/server/event.ts';
import type { RequestHandler } from './$types';

const PAGES = ['/', '/events', '/leaderboards', '/records', '/compare', '/accuracy'];

function escapeXml(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export const GET: RequestHandler = async ({ url }) => {
	const index = await searchIndex().catch(() => null);
	const paths = [
		...PAGES,
		...(index?.events ?? []).map((event) => `/events/${event.code}`),
		...(index?.teams ?? []).map((team) => `/teams/${team.number}`)
	];
	const entries = paths.map((path) => `<url><loc>${escapeXml(url.origin + path)}</loc></url>`);
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
