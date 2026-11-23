import { error, redirect } from '@sveltejs/kit';
import { parseRegionCode } from '#lib/components/region/regions.ts';
import { DataError } from '#lib/server/errors.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import { loadRegion } from '#lib/server/regions.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const code = parseRegionCode(params.code);
	if (!code) error(404, 'Region not found');
	if (code !== params.code) redirect(308, `/regions/${code}`);
	const region = await loadRegion(code).catch((failure: unknown) => {
		if (failure instanceof DataError && failure.status === 404) error(404, 'Region not found');
		error(503, 'This region is unavailable right now');
	});
	setHeaders({ 'cache-control': region.complete ? CACHE_CONTROL.ratings : CACHE_CONTROL.short });
	return region;
};
