import { addDays } from '#lib/format/calendar.ts';
import { matchLabel, parseMatchKey } from '#lib/format/match.ts';
import { regionName } from '#lib/format/places.ts';
import { PART_LABELS } from '#lib/game/biobuzz.ts';
import { EVENT_TYPE_NAMES } from '#lib/game/event-types.ts';
import { plausibleScore } from '#lib/model/types.ts';
import type {
	AllianceColor,
	EventType,
	SeasonMatch,
	SeasonMatchAlliance,
	TournamentLevel
} from '#lib/types.ts';

export const RECORDS_PAGE_SIZE = 50;

export const RECORDS_CSV_LIMIT = 1000;

export const RECORD_PARTS = [
	{ key: 'total', label: PART_LABELS.total },
	{ key: 'auto', label: PART_LABELS.auto },
	{ key: 'teleop', label: PART_LABELS.teleop },
	{ key: 'hive', label: PART_LABELS.hive },
	{ key: 'flower', label: PART_LABELS.flower },
	{ key: 'garden', label: PART_LABELS.garden }
] as const;

export type RecordPart = (typeof RECORD_PARTS)[number]['key'];

export const RECORD_RANGES = [
	{ key: 'all', label: 'All season' },
	{ key: '30', label: 'Last 30 days' },
	{ key: '7', label: 'Last 7 days' }
] as const;

export type RecordRange = (typeof RECORD_RANGES)[number]['key'];

export interface RecordRow {
	event: string;
	day: string;
	type: EventType;
	region: string | null;
	key: string;
	label: string;
	level: TournamentLevel;
	alliance: AllianceColor;
	teams: number[];
	opponents: number[];
	result: 'win' | 'loss' | 'tie';
	total: number;
	opponent: number;
	auto: number;
	teleop: number;
	hive: number;
	flower: number;
	garden: number;
	park: number;
	tips: number;
}

export interface RankedRecord extends RecordRow {
	rank: number;
}

export interface RecordFilters {
	part: RecordPart;
	range: RecordRange;
	region: string;
	type: EventType | '';
	level: TournamentLevel | '';
	team: number | null;
	page: number;
}

export interface RecordOption {
	value: string;
	label: string;
}

export interface RecordDataset {
	rows: RecordRow[];
	regions: RecordOption[];
	types: RecordOption[];
}

export interface RecordPage {
	rows: RankedRecord[];
	total: number;
	page: number;
	pages: number;
	start: number;
}

const REGION = /^[A-Za-z0-9]{1,12}$/;

function isPart(value: string | null): value is RecordPart {
	return RECORD_PARTS.some((part) => part.key === value);
}

function isRange(value: string | null): value is RecordRange {
	return RECORD_RANGES.some((range) => range.key === value);
}

function isType(value: string | null): value is EventType {
	return value !== null && value in EVENT_TYPE_NAMES;
}

function whole(value: string | null, fallback: number, low: number, high: number): number {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) ? Math.min(Math.max(parsed, low), high) : fallback;
}

export function parseRecordFilters(params: URLSearchParams): RecordFilters {
	const part = params.get('part');
	const range = params.get('range');
	const type = params.get('type');
	const level = params.get('level');
	const region = params.get('region')?.trim() ?? '';
	const team = whole(params.get('team'), 0, 0, 999_999);
	return {
		part: isPart(part) ? part : 'total',
		range: isRange(range) ? range : 'all',
		region: REGION.test(region) ? region.toUpperCase() : '',
		type: isType(type) ? type : '',
		level: level === 'qual' || level === 'playoff' ? level : '',
		team: team > 0 ? team : null,
		page: whole(params.get('page'), 1, 1, 10_000)
	};
}

export function recordQuery(filters: Partial<RecordFilters>, page = filters.page ?? 1): string {
	const params = new URLSearchParams();
	if (filters.part && filters.part !== 'total') params.set('part', filters.part);
	if (filters.range && filters.range !== 'all') params.set('range', filters.range);
	if (filters.region) params.set('region', filters.region);
	if (filters.type) params.set('type', filters.type);
	if (filters.level) params.set('level', filters.level);
	if (filters.team) params.set('team', String(filters.team));
	if (page > 1) params.set('page', String(page));
	const text = params.toString();
	return text ? `?${text}` : '';
}

function keyLabel(key: string): string {
	const parsed = parseMatchKey(key);
	return parsed ? matchLabel(parsed) : key.toUpperCase();
}

export function matchDay(match: SeasonMatch): string {
	if (match.time === null) return match.date;
	const day = new Date(match.time).toISOString().slice(0, 10);
	if (day < match.date) return match.date;
	return day > match.end ? match.end : day;
}

function side(
	match: SeasonMatch,
	alliance: AllianceColor,
	own: SeasonMatchAlliance,
	other: SeasonMatchAlliance
): RecordRow {
	return {
		event: match.eventCode,
		day: matchDay(match),
		type: match.eventType,
		region: match.region,
		key: match.key,
		label: keyLabel(match.key),
		level: match.level,
		alliance,
		teams: own.teams,
		opponents: other.teams,
		result: own.total === other.total ? 'tie' : own.total > other.total ? 'win' : 'loss',
		total: own.preFoulTotal,
		opponent: other.preFoulTotal,
		auto: own.auto,
		teleop: own.teleop,
		hive: own.hive,
		flower: own.flower,
		garden: own.garden,
		park: own.park,
		tips: own.tips
	};
}

function byLabel(a: RecordOption, b: RecordOption): number {
	return a.label.localeCompare(b.label, 'en', { numeric: true });
}

function plausible(alliance: SeasonMatchAlliance): boolean {
	return plausibleScore(alliance.total, alliance.preFoulTotal, alliance.auto, alliance.teleop);
}

export function plausibleMatch(match: SeasonMatch): boolean {
	return plausible(match.red) && plausible(match.blue);
}

export function buildRecordDataset(matches: SeasonMatch[]): RecordDataset {
	const rows = matches.flatMap((match) =>
		match.red.teams.length > 0 && match.blue.teams.length > 0 && plausibleMatch(match)
			? [side(match, 'red', match.red, match.blue), side(match, 'blue', match.blue, match.red)]
			: []
	);
	const regions = new Set<string>();
	const types = new Set<EventType>();
	for (const row of rows) {
		if (row.region) regions.add(row.region);
		types.add(row.type);
	}
	return {
		rows,
		regions: [...regions].map((value) => ({ value, label: regionName(value) })).sort(byLabel),
		types: [...types].map((value) => ({ value, label: EVENT_TYPE_NAMES[value] })).sort(byLabel)
	};
}

export function filterRecords(
	rows: RecordRow[],
	filters: RecordFilters,
	today: string
): RecordRow[] {
	const since = filters.range === 'all' ? '' : addDays(today, 1 - Number(filters.range));
	const part = filters.part;
	return rows
		.filter(
			(row) =>
				row.day >= since &&
				(!filters.region || row.region === filters.region) &&
				(!filters.type || row.type === filters.type) &&
				(!filters.level || row.level === filters.level) &&
				(filters.team === null || row.teams.includes(filters.team))
		)
		.sort(
			(a, b) =>
				b[part] - a[part] ||
				b.total - a.total ||
				a.day.localeCompare(b.day) ||
				a.event.localeCompare(b.event) ||
				a.key.localeCompare(b.key, 'en', { numeric: true }) ||
				a.alliance.localeCompare(b.alliance)
		);
}

export function pageRecords(
	sorted: RecordRow[],
	part: RecordPart,
	page: number,
	size = RECORDS_PAGE_SIZE
): RecordPage {
	const pages = Math.max(1, Math.ceil(sorted.length / size));
	const current = Math.min(Math.max(page, 1), pages);
	const start = (current - 1) * size;
	const rows = sorted.slice(start, start + size);
	let first = start;
	while (first > 0 && sorted[first - 1][part] === sorted[start]?.[part]) first -= 1;
	let rank = first + 1;
	return {
		rows: rows.map((row, index) => {
			if (index > 0 && row[part] !== rows[index - 1][part]) rank = start + index + 1;
			return { ...row, rank };
		}),
		total: sorted.length,
		page: current,
		pages,
		start
	};
}
