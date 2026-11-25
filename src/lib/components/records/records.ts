import { addDays } from '#lib/format/calendar.ts';
import { matchLabel, parseMatchKey } from '#lib/format/match.ts';
import { regionName } from '#lib/format/places.ts';
import { search } from '#lib/format/url.ts';
import { PART_LABELS } from '#lib/game/biobuzz.ts';
import { TYPE_LABELS } from '#lib/components/event/event-meta.ts';
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

export const RECORD_GROUPS = [
	{ key: 'score', label: 'Match score' },
	{ key: 'teleop', label: 'Teleop points' },
	{ key: 'result', label: 'Result' },
	{ key: 'count', label: 'Counts' }
] as const;

export type RecordGroup = (typeof RECORD_GROUPS)[number]['key'];

export const RECORD_PARTS = [
	{ key: 'total', label: PART_LABELS.total, group: 'score', shown: true },
	{ key: 'auto', label: PART_LABELS.auto, group: 'score', shown: true },
	{ key: 'teleop', label: PART_LABELS.teleop, group: 'score', shown: true },
	{ key: 'fouls', label: PART_LABELS.fouls, group: 'score', shown: false },
	{ key: 'final', label: 'Final', group: 'score', shown: false },
	{ key: 'hive', label: PART_LABELS.hive, group: 'teleop', shown: true },
	{ key: 'flower', label: PART_LABELS.flower, group: 'teleop', shown: true },
	{ key: 'garden', label: PART_LABELS.garden, group: 'teleop', shown: true },
	{ key: 'park', label: PART_LABELS.park, group: 'teleop', shown: true },
	{ key: 'opponent', label: 'Opponent', group: 'result', shown: true },
	{ key: 'margin', label: 'Margin', group: 'result', shown: false },
	{ key: 'tips', label: PART_LABELS.tips, group: 'count', shown: false }
] as const;

export const RECORD_PART_NOTES: Record<RecordPart, string> = {
	total: "Alliance score without points from the other alliance's fouls",
	auto: 'Points scored in the autonomous period',
	teleop: 'Points scored in the driver-controlled period',
	fouls: "Points given by the other alliance's fouls",
	final: 'Official alliance score with foul points',
	hive: 'Teleop hive points',
	flower: 'Teleop flower points',
	garden: 'Teleop garden points',
	park: 'Teleop park points',
	opponent: "The other alliance's score without foul points",
	margin: "Total minus the other alliance's total",
	tips: 'Number of tips in the match'
};

export const DEFAULT_SHOWN: RecordPart[] = RECORD_PARTS.filter((part) => part.shown).map(
	(part) => part.key
);

export const RECORD_OPS = [
	{ key: 'gt', label: '>', name: 'more than' },
	{ key: 'gte', label: '≥', name: 'at least' },
	{ key: 'lt', label: '<', name: 'less than' },
	{ key: 'lte', label: '≤', name: 'at most' },
	{ key: 'eq', label: '=', name: 'equal to' },
	{ key: 'ne', label: '≠', name: 'not equal to' }
] as const;

export type RecordOp = (typeof RECORD_OPS)[number]['key'];

export interface RecordCondition {
	stat: RecordPart;
	op: RecordOp;
	value: number | RecordPart;
}

export const RECORD_CONDITION_LIMIT = 8;

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
	fouls: number;
	final: number;
	margin: number;
}

export interface RankedRecord extends RecordRow {
	rank: number;
}

export interface RecordFilters {
	part: RecordPart;
	dir: 'desc' | 'asc';
	range: RecordRange;
	region: string;
	type: EventType | '';
	level: TournamentLevel | '';
	team: number | null;
	show: RecordPart[] | null;
	match: 'all' | 'any';
	where: RecordCondition[];
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

function isOp(value: string): value is RecordOp {
	return RECORD_OPS.some((op) => op.key === value);
}

const CONDITION = /^([a-z]+)\.([a-z]+)\.(-?\d{1,4}|[a-z]+)$/;

export function parseCondition(text: string): RecordCondition | null {
	const found = CONDITION.exec(text.trim().toLowerCase());
	if (!found) return null;
	const [, stat, op, raw] = found;
	if (!isPart(stat) || !isOp(op)) return null;
	if (/^-?\d+$/.test(raw)) return { stat, op, value: Number(raw) };
	return isPart(raw) && raw !== stat ? { stat, op, value: raw } : null;
}

export function conditionParam(condition: RecordCondition): string {
	return `${condition.stat}.${condition.op}.${condition.value}`;
}

export function parseShown(value: string | null): RecordPart[] | null {
	if (value === null) return null;
	const picked = new Set(value.split(/[.,]/));
	const shown = RECORD_PARTS.filter((part) => picked.has(part.key)).map((part) => part.key);
	if (shown.length === 0) return null;
	return shown.join(',') === DEFAULT_SHOWN.join(',') ? null : shown;
}

export function shownParts(filters: Pick<RecordFilters, 'show' | 'part'>): RecordPart[] {
	const shown = new Set<RecordPart>(filters.show ?? DEFAULT_SHOWN);
	shown.add(filters.part);
	return RECORD_PARTS.filter((part) => shown.has(part.key)).map((part) => part.key);
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
	const where = params
		.getAll('f')
		.slice(0, RECORD_CONDITION_LIMIT)
		.flatMap((text) => parseCondition(text) ?? []);
	return {
		part: isPart(part) ? part : 'total',
		dir: params.get('dir') === 'asc' ? 'asc' : 'desc',
		range: isRange(range) ? range : 'all',
		region: REGION.test(region) ? region.toUpperCase() : '',
		type: isType(type) ? type : '',
		level: level === 'qual' || level === 'playoff' ? level : '',
		team: team > 0 ? team : null,
		show: parseShown(params.get('show')),
		match: where.length > 1 && params.get('match') === 'any' ? 'any' : 'all',
		where,
		page: whole(params.get('page'), 1, 1, 10_000)
	};
}

export function recordQuery(filters: Partial<RecordFilters>, page = filters.page ?? 1): string {
	const params = new URLSearchParams();
	if (filters.part && filters.part !== 'total') params.set('part', filters.part);
	if (filters.dir === 'asc') params.set('dir', 'asc');
	if (filters.range && filters.range !== 'all') params.set('range', filters.range);
	if (filters.region) params.set('region', filters.region);
	if (filters.type) params.set('type', filters.type);
	if (filters.level) params.set('level', filters.level);
	if (filters.team) params.set('team', String(filters.team));
	if (filters.show) params.set('show', filters.show.join('.'));
	if (filters.match === 'any' && (filters.where?.length ?? 0) > 1) params.set('match', 'any');
	for (const condition of filters.where ?? []) params.append('f', conditionParam(condition));
	if (page > 1) params.set('page', String(page));
	return search(params);
}

function keyLabel(key: string): string {
	const parsed = parseMatchKey(key);
	return parsed ? matchLabel(parsed) : key.toUpperCase();
}

export function hasRecordFilters(filters: RecordFilters): boolean {
	return Boolean(
		filters.range !== 'all' ||
		filters.region ||
		filters.type ||
		filters.level ||
		filters.team ||
		filters.where.length > 0
	);
}

export function clearedRecords(filters: RecordFilters): string {
	return `/records${recordQuery({ part: filters.part, dir: filters.dir, show: filters.show })}`;
}

export function partLabel(part: RecordPart): string {
	return RECORD_PARTS.find((entry) => entry.key === part)?.label ?? part;
}

export function conditionText(condition: RecordCondition): string {
	const op = RECORD_OPS.find((entry) => entry.key === condition.op)?.label ?? condition.op;
	const value =
		typeof condition.value === 'number' ? String(condition.value) : partLabel(condition.value);
	return `${partLabel(condition.stat)} ${op} ${value}`;
}

const LEVEL_LABELS = { qual: 'Quals only', playoff: 'Playoffs only' } as const;

function optionLabel(options: RecordOption[], value: string): string {
	return value ? (options.find((option) => option.value === value)?.label ?? value) : '';
}

export function recordSummary(
	filters: RecordFilters,
	options: { regions: RecordOption[]; types: RecordOption[] }
): string[] {
	const range = RECORD_RANGES.find((entry) => entry.key === filters.range);
	const part = RECORD_PARTS.find((entry) => entry.key === filters.part);
	return [
		range && range.key !== 'all' ? range.label : '',
		optionLabel(options.regions, filters.region),
		optionLabel(options.types, filters.type),
		filters.level ? LEVEL_LABELS[filters.level] : '',
		filters.team ? `Team ${filters.team}` : '',
		filters.where.length === 0
			? ''
			: `${filters.match === 'any' ? 'Any of ' : ''}${filters.where.map(conditionText).join(', ')}`,
		part && (part.key !== 'total' || filters.dir === 'asc')
			? `By ${part.label.toLowerCase()}${filters.dir === 'asc' ? ', low to high' : ''}`
			: ''
	].filter(Boolean);
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
		tips: own.tips,
		fouls: own.foulPoints,
		final: own.total,
		margin: own.preFoulTotal - other.preFoulTotal
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
		types: [...types].map((value) => ({ value, label: TYPE_LABELS[value] })).sort(byLabel)
	};
}

export function passes(row: RecordRow, condition: RecordCondition): boolean {
	const left = row[condition.stat];
	const right = typeof condition.value === 'number' ? condition.value : row[condition.value];
	switch (condition.op) {
		case 'gt':
			return left > right;
		case 'gte':
			return left >= right;
		case 'lt':
			return left < right;
		case 'lte':
			return left <= right;
		case 'eq':
			return left === right;
		case 'ne':
			return left !== right;
	}
}

export function filterRecords(
	rows: RecordRow[],
	filters: RecordFilters,
	today: string
): RecordRow[] {
	const since = filters.range === 'all' ? '' : addDays(today, 1 - Number(filters.range));
	const part = filters.part;
	const sign = filters.dir === 'asc' ? -1 : 1;
	const where = filters.where;
	const fits = (row: RecordRow) =>
		where.length === 0 ||
		(filters.match === 'any'
			? where.some((condition) => passes(row, condition))
			: where.every((condition) => passes(row, condition)));
	return rows
		.filter(
			(row) =>
				row.day >= since &&
				(!filters.region || row.region === filters.region) &&
				(!filters.type || row.type === filters.type) &&
				(!filters.level || row.level === filters.level) &&
				(filters.team === null || row.teams.includes(filters.team)) &&
				fits(row)
		)
		.sort(
			(a, b) =>
				sign * (b[part] - a[part]) ||
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
