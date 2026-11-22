import { error } from '@sveltejs/kit';
import { loadEventAnalysisEntry } from '#lib/server/analysis.ts';
import { DataError } from '#lib/server/errors.ts';
import { loadEventBundle } from '#lib/server/event.ts';
import { CACHE_CONTROL, shortestCache } from '#lib/server/http.ts';
import { sharedWorkspaces } from '#lib/workspace/shared.server.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, depends, setHeaders }) => {
	depends('app:alliance-selection', 'event:live');
	try {
		const [{ cacheControl, ...bundle }, entry] = await Promise.all([
			loadEventBundle(params.code),
			loadEventAnalysisEntry(params.code).catch(() => null)
		]);
		const picking = bundle.phase === 'selection';
		setHeaders({
			'cache-control': picking
				? CACHE_CONTROL.none
				: shortestCache(cacheControl, entry?.cacheControl ?? CACHE_CONTROL.live)
		});
		return {
			selection: { bundle, analysis: entry?.analysis ?? null },
			workspaceShared: sharedWorkspaces()
		};
	} catch (cause) {
		if (cause instanceof DataError) error(cause.status, cause.message);
		throw cause;
	}
};
