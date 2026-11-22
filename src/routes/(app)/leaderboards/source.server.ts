import {
	buildRatingRows,
	createDataset,
	eventFilterOptions,
	isScoped,
	scopeRows,
	type EventFilterOptions,
	type LeaderboardDataset,
	type LeaderboardScope
} from '#lib/components/team/leaderboard.ts';
import { ratedTeams } from '#lib/components/team/team-view.ts';
import { loadSeasonEventRatingsWithin, loadSeasonRatingsWithin } from '#lib/server/analysis.ts';
import { LruMap, settleWithin } from '#lib/server/cache.ts';
import { unavailable } from '#lib/server/errors.ts';
import { searchIndex } from '#lib/server/event.ts';
import { scoutLeaderboard } from './scout.server.ts';

export interface LeaderboardSource {
	key: string;
	kind: 'ratings' | 'scout';
	dataset: LeaderboardDataset;
	updated: number;
	options: EventFilterOptions;
}

const RATINGS_WAIT_MS = 4_000;
const SCOUT_WAIT_MS = 2_500;
const NAMES_WAIT_MS = 2_000;
const NO_OPTIONS: EventFilterOptions = { types: [], weeks: [] };
const EVERYTHING: LeaderboardScope = { type: '', window: null };

let memo: LeaderboardSource | null = null;
const scoped = new LruMap<LeaderboardSource>(40);

function remember(key: string, build: () => Omit<LeaderboardSource, 'key'>): LeaderboardSource {
	const source = memo?.key === key ? memo : { key, ...build() };
	memo = source;
	return source;
}

function scopeKey(scope: LeaderboardScope): string {
	return [scope.type, scope.window?.from ?? '', scope.window?.to ?? ''].join(':');
}

export async function loadLeaderboardSource(
	scope: LeaderboardScope = EVERYTHING,
	today = new Date().toISOString().slice(0, 10)
): Promise<LeaderboardSource> {
	const filtered = isScoped(scope);
	const [ratings, directory, table] = await Promise.all([
		loadSeasonRatingsWithin(RATINGS_WAIT_MS).catch(() => null),
		settleWithin(searchIndex(), NAMES_WAIT_MS),
		filtered ? loadSeasonEventRatingsWithin(RATINGS_WAIT_MS).catch(() => null) : null
	]);
	if (ratings && ratedTeams(ratings).length > 0) {
		const options = eventFilterOptions(directory?.events ?? [], today);
		const base = remember(`ratings:${ratings.generatedAt}:${directory?.fetchedAt ?? 0}`, () => ({
			kind: 'ratings',
			dataset: createDataset(buildRatingRows(ratings, directory?.teams ?? [])),
			updated: ratings.generatedAt,
			options
		}));
		if (!filtered) return { ...base, options };
		if (!table) throw unavailable('Event ratings are still loading');
		const key = `${base.key}:${table.generatedAt}:${scopeKey(scope)}`;
		const known = scoped.get(key);
		if (known) return { ...known, options };
		const source: LeaderboardSource = {
			key,
			kind: 'ratings',
			dataset: { ...base.dataset, rows: scopeRows(base.dataset.rows, table, scope) },
			updated: table.generatedAt,
			options
		};
		scoped.set(key, source);
		return source;
	}
	const fallback = await settleWithin(scoutLeaderboard.load(), SCOUT_WAIT_MS);
	if (!fallback) throw unavailable('Season ratings are still loading');
	const { rows, fetchedAt } = fallback;
	return remember(`scout:${fetchedAt}`, () => ({
		kind: 'scout',
		dataset: createDataset(rows),
		updated: fetchedAt,
		options: NO_OPTIONS
	}));
}
