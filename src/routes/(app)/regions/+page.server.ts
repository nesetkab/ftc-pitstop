import { error } from '@sveltejs/kit';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { loadRegionList } from '#lib/server/regions.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
	const list = await loadRegionList().catch(() => null);
	if (!list) error(503, 'Regions are unavailable right now');
	const settled = list.updated !== null && !list.stale;
	setHeaders({ 'cache-control': settled ? CACHE_CONTROL.ratings : CACHE_CONTROL.short });
	return list;
};
