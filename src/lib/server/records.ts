import { partAverages, type PartAverages } from '#lib/components/event/insights.ts';
import { buildRecordDataset, type RecordDataset } from '#lib/components/records/records.ts';
import { loadSeasonModelWithin } from '#lib/server/analysis.ts';
import { settleWithin } from '#lib/server/cache.ts';
import { searchIndex } from '#lib/server/event.ts';

const NAMES_WAIT_MS = 2_000;

let memo: { generatedAt: number; dataset: RecordDataset } | null = null;
let averagesMemo: { generatedAt: number; averages: PartAverages | null } | null = null;
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

export async function loadSeasonAverages(ms: number): Promise<PartAverages | null> {
	const source = await loadRecordDataset(ms);
	if (!source) return null;
	if (averagesMemo?.generatedAt !== source.updated) {
		averagesMemo = { generatedAt: source.updated, averages: partAverages(source.dataset.rows) };
	}
	return averagesMemo.averages;
}

export async function recordNames(
	teams: number[],
	events: string[]
): Promise<{ teams: Record<number, string>; events: Record<string, string> }> {
	const index = await settleWithin(searchIndex(), NAMES_WAIT_MS);
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
