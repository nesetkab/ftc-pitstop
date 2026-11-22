import {
	buildRatingRows,
	createDataset,
	type LeaderboardDataset
} from '#lib/components/team/leaderboard.ts';
import { ratedTeams } from '#lib/components/team/team-view.ts';
import { loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { searchIndex } from '#lib/server/event.ts';
import { scoutLeaderboard } from './scout.server.ts';

export interface LeaderboardSource {
	key: string;
	kind: 'ratings' | 'scout';
	dataset: LeaderboardDataset;
	updated: number;
}

let memo: LeaderboardSource | null = null;

function remember(key: string, build: () => Omit<LeaderboardSource, 'key'>): LeaderboardSource {
	const source = memo?.key === key ? memo : { key, ...build() };
	memo = source;
	return source;
}

export async function loadLeaderboardSource(): Promise<LeaderboardSource> {
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
