import { error } from '@sveltejs/kit';
import {
	championshipRow,
	filterIndex,
	parseRegion,
	regionOptions,
	unpostedIn
} from '#lib/components/advancement/advancement.ts';
import { loadAdvancement } from '#lib/server/advancement.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const loaded = await loadAdvancement().catch(() => null);
	if (!loaded) error(503, 'Advancement is unavailable right now');
	const regions = regionOptions(loaded.index);
	const chosen = parseRegion(url.searchParams.get('region'));
	const region = regions.some((option) => option.value === chosen) ? chosen : null;
	const index = filterIndex(loaded.index, region);
	setHeaders({ 'cache-control': CACHE_CONTROL.list });
	return {
		region,
		regions,
		rows: index.championships.map((championship) =>
			championshipRow(championship, unpostedIn(loaded.index, championship))
		),
		unassigned: index.unassigned,
		updated: loaded.index.generatedAt,
		stale: loaded.stale
	};
};
