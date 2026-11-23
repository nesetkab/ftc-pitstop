import type { SeasonRatings } from '#lib/analysis/types.ts';
import {
	championshipRow,
	filterIndex,
	unpostedIn,
	type AdvancementIndex,
	type ChampionshipRow,
	type Feeder
} from '#lib/components/advancement/advancement.ts';
import type { EventStatus } from '#lib/components/event/dates.ts';
import { listed, listStatus } from '#lib/components/event/event-list.ts';
import { rosterFor, type RankedStrength, type Rosters } from '#lib/components/event/strength.ts';
import {
	filterRecords,
	pageRecords,
	parseRecordFilters,
	type RankedRecord,
	type RecordRow
} from '#lib/components/records/records.ts';
import {
	buildRegions,
	groupEvents,
	type Region,
	type RegionEvent,
	type RegionSummary,
	type RegionTeam
} from '#lib/components/region/regions.ts';
import { localDate } from '#lib/format/calendar.ts';
import { loadAdvancement } from '#lib/server/advancement.ts';
import { loadSeasonRatings } from '#lib/server/analysis.ts';
import { settleWithin } from '#lib/server/cache.ts';
import { notFound, unavailable } from '#lib/server/errors.ts';
import { finishedEvents, loadSeasonEvents, searchIndex } from '#lib/server/event.ts';
import { loadRecordDataset } from '#lib/server/records.ts';
import { loadRosters } from '#lib/server/rosters.ts';
import { loadStrength } from '#lib/server/strength.ts';
import type { EventSummary, SearchTeam } from '#lib/types.ts';

const WAIT_MS = 3_000;
const RECORDS_WAIT_MS = 3_000;
const BUCKET_MS = 10 * 60_000;
const BEST_SCORES = 5;

export interface RegionDeps {
	loadSeasonEvents: () => Promise<{ events: EventSummary[]; fetchedAt: number; stale: boolean }>;
	loadRosters: () => Promise<Rosters>;
	loadSeasonRatings: () => Promise<SeasonRatings | null>;
	loadTeams: () => Promise<SearchTeam[]>;
	loadStrength: () => Promise<RankedStrength>;
	loadAdvancement: () => Promise<{ index: AdvancementIndex; stale: boolean }>;
	loadRecords: () => Promise<RecordRow[] | null>;
	finishedEvents: () => string[];
	now?: () => number;
	waitMs?: number;
}

export interface RegionList {
	regions: RegionSummary[];
	updated: number | null;
	fetchedAt: number;
	stale: boolean;
}

export interface RegionNames {
	teams: Record<number, string>;
	events: Record<string, string>;
}

export interface RegionPage {
	summary: RegionSummary;
	teams: RegionTeam[];
	events: Record<EventStatus, RegionEvent[]>;
	advancement: { rows: ChampionshipRow[]; unassigned: Feeder[] } | null;
	records: RankedRecord[] | null;
	names: RegionNames;
	updated: number | null;
	complete: boolean;
}

interface Built {
	inputs: unknown[];
	regions: Map<string, Region>;
	teamNames: Map<number, string>;
	eventNames: Map<string, string>;
}

export function createRegions(deps: RegionDeps) {
	const now = deps.now ?? (() => Date.now());
	const wait = deps.waitMs ?? WAIT_MS;
	let built: Built | null = null;

	function within<T>(load: () => Promise<T>): Promise<T | null> {
		return settleWithin(load(), wait);
	}

	async function base() {
		const [list, rosters, ratings, teams] = await Promise.all([
			deps.loadSeasonEvents().catch(() => null),
			within(deps.loadRosters),
			within(deps.loadSeasonRatings),
			within(deps.loadTeams)
		]);
		if (!list) throw unavailable('The event list is unavailable right now');
		const time = now();
		const finished = deps.finishedEvents().toSorted().join(' ');
		const inputs = [list.events, rosters, ratings, teams, finished, Math.floor(time / BUCKET_MS)];
		if (!built || built.inputs.some((value, at) => value !== inputs[at])) {
			built = {
				inputs,
				regions: buildRegions({
					events: list.events,
					rosters,
					ratings,
					teams: teams ?? [],
					finished: new Set(finished.split(' ')),
					now: time
				}),
				teamNames: new Map((teams ?? []).map((team) => [team.number, team.name])),
				eventNames: new Map(list.events.map((event) => [event.code, event.name]))
			};
		}
		return { list, ratings, rosters, time, finished: new Set(finished.split(' ')), built };
	}

	async function loadRegionList(): Promise<RegionList> {
		const { list, ratings, built } = await base();
		return {
			regions: [...built.regions.values()].map((region) => region.summary),
			updated: ratings?.generatedAt ?? null,
			fetchedAt: list.fetchedAt,
			stale: list.stale
		};
	}

	function names(built: Built, records: RankedRecord[]): RegionNames {
		const numbers = new Set(records.flatMap((row) => row.teams));
		const codes = new Set(records.map((row) => row.event));
		return {
			teams: Object.fromEntries(
				[...numbers].flatMap((team) => {
					const name = built.teamNames.get(team);
					return name ? [[team, name]] : [];
				})
			),
			events: Object.fromEntries(
				[...codes].flatMap((code) => {
					const name = built.eventNames.get(code);
					return name ? [[code, name]] : [];
				})
			)
		};
	}

	function bestScores(rows: RecordRow[], code: string, time: number): RankedRecord[] {
		const filters = { ...parseRecordFilters(new URLSearchParams()), region: code };
		const sorted = filterRecords(rows, filters, localDate(time, 'UTC'));
		return pageRecords(sorted, 'total', 1, BEST_SCORES).rows;
	}

	function advancementFor(index: AdvancementIndex, code: string) {
		const local = filterIndex(index, code);
		const rows = local.championships.map((championship) =>
			championshipRow(championship, unpostedIn(index, championship))
		);
		return { rows, unassigned: local.unassigned };
	}

	async function loadRegion(code: string): Promise<RegionPage> {
		const extras = Promise.all([
			within(deps.loadStrength),
			within(deps.loadAdvancement),
			within(deps.loadRecords)
		]);
		const [{ ratings, rosters, time, finished, built }, [strength, advancement, rows]] =
			await Promise.all([base(), extras]);
		const region = built.regions.get(code);
		if (!region) throw notFound('Region not found');
		const events = region.events.map((event): RegionEvent => ({
			...listed(
				event,
				rosterFor(event, rosters?.[event.code], time).length || null,
				strength?.events.get(event.code)?.top ?? null
			),
			status: listStatus(event, time, finished)
		}));
		const records = rows ? bestScores(rows, code, time) : null;
		return {
			summary: region.summary,
			teams: region.teams,
			events: groupEvents(events),
			advancement: advancement ? advancementFor(advancement.index, code) : null,
			records,
			names: names(built, records ?? []),
			updated: ratings?.generatedAt ?? null,
			complete: Boolean(ratings && strength && advancement && rows && rosters)
		};
	}

	return { loadRegionList, loadRegion };
}

export const regions = createRegions({
	loadSeasonEvents,
	loadRosters,
	loadSeasonRatings,
	loadTeams: async () => (await searchIndex()).teams,
	loadStrength,
	loadAdvancement,
	loadRecords: async () => (await loadRecordDataset(RECORDS_WAIT_MS))?.dataset.rows ?? null,
	finishedEvents
});

export const { loadRegionList, loadRegion } = regions;
