import { error, redirect } from '@sveltejs/kit';
import { loadEventAnalysisEntry } from '#lib/server/analysis.ts';
import { DataError, loadEventBundle, normalizeEventCode } from '#lib/server/event.ts';
import { CACHE_CONTROL, shortestCache } from '#lib/server/http.ts';
import type { LayoutServerLoad } from './$types';

function failure(cause: unknown): never {
	if (cause instanceof DataError && cause.status === 404) error(404, 'Event not found');
	if (cause instanceof DataError) error(cause.status, cause.message);
	error(503, 'Event data is unavailable right now');
}

const OWN_HEADERS = /\/(teams|alliance-selection)$/;

export const load: LayoutServerLoad = async ({
	params,
	depends,
	url,
	route,
	untrack,
	setHeaders
}) => {
	depends('event:live');
	let code: string;
	try {
		code = normalizeEventCode(params.code);
	} catch (cause) {
		failure(cause);
	}
	if (code !== params.code) {
		const target = untrack(
			() => url.pathname.replace(/^\/events\/[^/]+/, `/events/${code}`) + url.search
		);
		redirect(308, target);
	}
	const [{ cacheControl: bundleCache, ...bundle }, entry] = await Promise.all([
		loadEventBundle(code).catch(failure),
		loadEventAnalysisEntry(code).catch(() => null)
	]);
	const cacheControl = shortestCache(bundleCache, entry?.cacheControl ?? CACHE_CONTROL.live);
	if (!OWN_HEADERS.test(untrack(() => route.id) ?? '')) {
		setHeaders({ 'cache-control': cacheControl });
	}
	return { bundle, analysis: entry?.analysis ?? null, cacheControl };
};
