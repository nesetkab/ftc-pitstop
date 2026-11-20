import { error } from '@sveltejs/kit';
import {
	buildRatingRows,
	createDataset,
	filterRows,
	paginate,
	parseFilters,
	type LeaderboardDataset
} from '#lib/components/team/leaderboard.ts';
import { ratedTeams } from '#lib/components/team/team-view.ts';
import { loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { searchIndex } from '#lib/server/event.ts';
import { CACHE_CONTROL } from '#lib/server/http.ts';
import type { PageServerLoad } from './$types';
import { scoutLeaderboard } from './scout.server.ts';

interface Source {
	key: string;
	kind: 'ratings' | 'scout';
	dataset: LeaderboardDataset;
	updated: number;
}

let memo: Source | null = null;

function remember(key: string, build: () => Omit<Source, 'key'>): Source {
	const source = memo?.key === key ? memo : { key, ...build() };
	memo = source;
	return source;
}

async function loadSource(): Promise<Source> {
	const ratings = await loadSeasonRatingsWithin(20_000).catch(() => null);
	if (ratings && ratedTeams(ratings).length > 0) {
		const directory = await searchIndex().catch(() => null);
		return remember(`ratings:${ratings.generatedAt}:${directory?.fetchedAt ?? 0}`, () => ({
			kind: 'ratings',
			dataset: createDataset(buildRatingRows(ratings, directory?.teams ?? [])),
			updated: ratings.generatedAt
		}));
	}
	const { rows, fetchedAt } = await scoutLeaderboard.load();
	return remember(`scout:${fetchedAt}`, () => ({
		kind: 'scout',
		dataset: createDataset(rows),
		updated: fetchedAt
	}));
}

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const filters = parseFilters(url.searchParams);
	const source = await loadSource().catch(() =>
		error(503, 'Season ratings are still loading. Try again in a minute.')
	);
	const { dataset } = source;
	const result = paginate(filterRows(dataset.rows, filters), filters.page);
	setHeaders({ 'cache-control': CACHE_CONTROL.short });
	return {
		source: source.kind,
		updated: source.updated,
		filters: { ...filters, page: result.page },
		rows: result.rows,
		total: result.total,
		page: result.page,
		pages: result.pages,
		start: result.start,
		population: dataset.rows.length,
		regions: dataset.regions,
		countries: dataset.countries,
		states: dataset.states[filters.country] ?? []
	};
};
