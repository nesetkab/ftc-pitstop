import type { RankedRecord, RecordRow } from '#lib/components/records/records.ts';
import { localDay } from '#lib/components/team/dates.ts';
import { breakdownParts, tips } from '#lib/game/biobuzz.ts';
import type { AllianceColor, Event, Match, TournamentLevel } from '#lib/types.ts';

export const INSIGHT_PARTS = [
	{ key: 'total', label: 'Total' },
	{ key: 'auto', label: 'Auto' },
	{ key: 'teleop', label: 'Teleop' },
	{ key: 'hive', label: 'Hive' },
	{ key: 'flower', label: 'Flower' },
	{ key: 'garden', label: 'Garden' },
	{ key: 'park', label: 'Park' },
	{ key: 'tips', label: 'Tips' }
] as const;

export type InsightPart = (typeof INSIGHT_PARTS)[number]['key'];

export const INSIGHT_LIMIT = 20;

export interface InsightFilters {
	sort: InsightPart;
	level: TournamentLevel | '';
	all: boolean;
}

export type PartValues = Record<InsightPart, number>;

export interface PartAverages extends PartValues {
	count: number;
}

export type InsightEvent = Pick<Event, 'code' | 'type' | 'region' | 'start' | 'end' | 'timezone'>;

function isPart(value: string | null): value is InsightPart {
	return INSIGHT_PARTS.some((part) => part.key === value);
}

export function parseInsightFilters(params: URLSearchParams): InsightFilters {
	const sort = params.get('sort');
	const level = params.get('level');
	return {
		sort: isPart(sort) ? sort : 'total',
		level: level === 'qual' || level === 'playoff' ? level : '',
		all: params.get('all') === '1'
	};
}

export function insightQuery(filters: Partial<InsightFilters>): string {
	const params = new URLSearchParams();
	if (filters.sort && filters.sort !== 'total') params.set('sort', filters.sort);
	if (filters.level) params.set('level', filters.level);
	if (filters.all) params.set('all', '1');
	const text = params.toString();
	return text ? `?${text}` : '';
}

function dayOf(event: InsightEvent, match: Match): string {
	const time = match.actualTime ?? match.scheduledTime;
	if (time === null) return event.start;
	const day = localDay(time, event.timezone);
	if (day < event.start) return event.start;
	return day > event.end ? event.end : day;
}

function side(event: InsightEvent, match: Match, alliance: AllianceColor): RecordRow | null {
	const result = match.result;
	const other: AllianceColor = alliance === 'red' ? 'blue' : 'red';
	if (!result || match[alliance].length === 0 || match[other].length === 0) return null;
	const own = result[alliance];
	const parts = breakdownParts(own);
	return {
		event: event.code,
		day: dayOf(event, match),
		type: event.type,
		region: event.region,
		key: match.key,
		label: match.label,
		level: match.level,
		alliance,
		teams: match[alliance].map((entry) => entry.team),
		opponents: match[other].map((entry) => entry.team),
		result: result.winner === alliance ? 'win' : result.winner === other ? 'loss' : 'tie',
		total: own.preFoulTotal,
		opponent: result[other].preFoulTotal,
		auto: own.auto,
		teleop: own.teleop,
		hive: parts.hive,
		flower: parts.flower,
		garden: parts.garden,
		park: parts.park,
		tips: own.breakdown ? tips(own.breakdown) : 0
	};
}

export function eventRecordRows(event: InsightEvent, matches: Match[]): RecordRow[] {
	return matches.flatMap((match) =>
		[side(event, match, 'red'), side(event, match, 'blue')].filter(
			(row): row is RecordRow => row !== null
		)
	);
}

export function sortInsights(rows: RecordRow[], filters: InsightFilters): RecordRow[] {
	const part = filters.sort;
	return rows
		.filter((row) => !filters.level || row.level === filters.level)
		.map((row, index) => ({ row, index }))
		.sort((a, b) => b.row[part] - a.row[part] || b.row.total - a.row.total || a.index - b.index)
		.map(({ row }) => row);
}

export function rankInsights(sorted: RecordRow[], part: InsightPart): RankedRecord[] {
	let rank = 0;
	return sorted.map((row, index) => {
		if (index === 0 || row[part] !== sorted[index - 1][part]) rank = index + 1;
		return { ...row, rank };
	});
}

export function partAverages(rows: RecordRow[]): PartAverages | null {
	if (rows.length === 0) return null;
	const averages = { count: rows.length } as PartAverages;
	for (const { key } of INSIGHT_PARTS) {
		averages[key] = rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
	}
	return averages;
}

export function partHighs(rows: RecordRow[]): PartValues | null {
	if (rows.length === 0) return null;
	const highs = {} as PartValues;
	for (const { key } of INSIGHT_PARTS) {
		highs[key] = rows.reduce((high, row) => Math.max(high, row[key]), 0);
	}
	return highs;
}

export function npMax(matches: Match[]): Map<number, number> {
	const best = new Map<number, number>();
	for (const match of matches) {
		if (match.level !== 'qual' || !match.result) continue;
		for (const color of ['red', 'blue'] as const) {
			const score = match.result[color].preFoulTotal;
			for (const entry of match[color]) {
				if (entry.noShow) continue;
				best.set(entry.team, Math.max(best.get(entry.team) ?? 0, score));
			}
		}
	}
	return best;
}
