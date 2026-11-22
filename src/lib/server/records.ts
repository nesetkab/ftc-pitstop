import {
	buildRecordDataset,
	filterRecords,
	pageRecords,
	parseRecordFilters,
	type RankedRecord,
	type RecordDataset
} from '#lib/components/records/records.ts';
import { localDay } from '#lib/components/team/dates.ts';
import { loadSeasonModelWithin } from '#lib/server/analysis.ts';
import { searchIndex } from '#lib/server/event.ts';

let memo: { generatedAt: number; dataset: RecordDataset } | null = null;
let directory: {
	fetchedAt: number;
	teams: Map<number, string>;
	events: Map<string, string>;
} | null = null;

export async function loadRecordDataset(
	ms: number
): Promise<{ dataset: RecordDataset; updated: number } | null> {
	const model = await loadSeasonModelWithin(ms);
	if (!model) return null;
	if (memo?.generatedAt !== model.generatedAt) {
		memo = { generatedAt: model.generatedAt, dataset: buildRecordDataset(model.matches) };
	}
	return { dataset: memo.dataset, updated: model.generatedAt };
}

export async function recordNames(
	teams: number[],
	events: string[]
): Promise<{ teams: Record<number, string>; events: Record<string, string> }> {
	const index = await searchIndex().catch(() => null);
	if (index && directory?.fetchedAt !== index.fetchedAt) {
		directory = {
			fetchedAt: index.fetchedAt,
			teams: new Map(index.teams.map((team) => [team.number, team.name])),
			events: new Map(index.events.map((event) => [event.code, event.name]))
		};
	}
	const pick = <K extends string | number>(keys: K[], from: Map<K, string> | undefined) =>
		Object.fromEntries(
			[...new Set(keys)].flatMap((key) => {
				const name = from?.get(key);
				return name ? [[key, name]] : [];
			})
		);
	return { teams: pick(teams, directory?.teams), events: pick(events, directory?.events) };
}

export interface RecentRecords {
	rows: RankedRecord[];
	names: { teams: Record<number, string>; events: Record<string, string> };
}

export async function loadRecentRecords(count: number, ms: number): Promise<RecentRecords | null> {
	const source = await loadRecordDataset(ms);
	if (!source) return null;
	const filters = parseRecordFilters(new URLSearchParams({ range: '7' }));
	const sorted = filterRecords(source.dataset.rows, filters, localDay(Date.now(), 'UTC'));
	const rows = pageRecords(sorted, 'total', 1, count).rows;
	if (rows.length === 0) return null;
	const names = await recordNames(
		rows.flatMap((row) => row.teams),
		rows.map((row) => row.event)
	);
	return { rows, names };
}
