import { error } from '@sveltejs/kit';
import { filterRecords, pageRecords, parseRecordFilters } from '#lib/components/records/records.ts';
import { localDay } from '#lib/components/team/dates.ts';
import { loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { loadEventBundle, loadTeamSeason } from '#lib/server/event.ts';
import { cardFor, type OgDeps } from '#lib/server/og/load.ts';
import { renderPng } from '#lib/server/og/render.ts';
import { loadRecordDataset, recordNames } from '#lib/server/records.ts';
import type { RequestHandler } from './$types';

const deps: OgDeps = {
	loadTeamSeason,
	loadSeasonRatings: () => loadSeasonRatingsWithin(3500),
	loadEventBundle,
	async loadTopRecords(count) {
		const source = await loadRecordDataset(3500);
		if (!source) return null;
		const filters = parseRecordFilters(new URLSearchParams());
		const sorted = filterRecords(source.dataset.rows, filters, localDay(Date.now(), 'UTC'));
		return pageRecords(sorted, 'total', 1, count).rows;
	},
	loadNames: recordNames
};

export const GET: RequestHandler = async ({ params, url }) => {
	const card = await cardFor(params.path, url.host, deps);
	if (!card) error(404, 'Not found');
	const png = await renderPng(card.node);
	return new Response(png, {
		headers: {
			'content-type': 'image/png',
			'cache-control': `public, max-age=${Math.min(card.maxAge, 3600)}, s-maxage=${card.maxAge}, stale-while-revalidate=86400`
		}
	});
};
