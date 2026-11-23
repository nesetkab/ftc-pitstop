import { error } from '@sveltejs/kit';
import { forRegion, parseRegion, unpostedIn } from '#lib/components/advancement/advancement.ts';
import { loadAdvancement } from '#lib/server/advancement.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
	const code = params.code.toUpperCase();
	if (!/^[A-Z0-9]{2,24}$/.test(code)) error(404, 'Championship not found');
	const loaded = await loadAdvancement().catch(() => null);
	if (!loaded) error(503, 'Advancement is unavailable right now');
	const { championships } = loaded.index;
	const found = championships.find((entry) => entry.code === code);
	if (!found) error(404, 'Championship not found');
	const chosen = parseRegion(url.searchParams.get('region'));
	const region =
		chosen && chosen !== found.region && found.feeders.some((feeder) => feeder.region === chosen)
			? chosen
			: null;
	const next = found.advancesTo
		? championships.find((entry) => entry.code === found.advancesTo)
		: null;
	setHeaders({ 'cache-control': CACHE_CONTROL.list });
	return {
		championship: region ? forRegion(found, region) : found,
		region,
		unposted: unpostedIn(loaded.index, found),
		next: next ? { code: next.code, name: next.name } : null,
		updated: loaded.index.generatedAt,
		stale: loaded.stale
	};
};
