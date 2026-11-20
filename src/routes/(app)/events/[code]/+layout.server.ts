import { error, redirect } from '@sveltejs/kit';
import { loadEventAnalysis } from '#lib/server/analysis.ts';
import { DataError, loadEventBundle, normalizeEventCode } from '#lib/server/event.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { LayoutServerLoad } from './$types';

function failure(cause: unknown): never {
	if (cause instanceof DataError && cause.status === 404) error(404, 'Event not found');
	if (cause instanceof DataError) error(cause.status, cause.message);
	error(503, 'Event data is unavailable right now');
}

export const load: LayoutServerLoad = async ({ params, depends, url, untrack, setHeaders }) => {
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
	const [bundle, analysis] = await Promise.all([
		loadEventBundle(code).catch(failure),
		loadEventAnalysis(code).catch(() => null)
	]);
	const live = bundle.phase !== 'upcoming' && bundle.phase !== 'done';
	setHeaders({ 'cache-control': live ? CACHE_CONTROL.live : CACHE_CONTROL.short });
	return { bundle, analysis };
};
