import type { Projection, TeamRating } from '#lib/analysis/types.ts';
import { fixed } from '#lib/format/number.ts';
import { record } from '#lib/format/record.ts';
import { PART_LABELS } from '#lib/game/biobuzz.ts';
import type { Match, Ranking } from '#lib/types.ts';

export type ScoreStats = { avg: number; max: number; min: number; sd: number; count: number };

export type RankingRow = {
	ranking: Ranking;
	rating: TeamRating | null;
	scores: ScoreStats | null;
	projection: Projection | null;
};

export type ColumnSource = 'ranking' | 'score' | 'rating';

export type RankingColumn = {
	key: string;
	label: string;
	name: string;
	title?: string;
	source: ColumnSource;
	digits: number;
	value: (row: RankingRow) => number | null;
	text?: (row: RankingRow) => string;
	csv?: { header: string[]; values: (row: RankingRow) => (number | null)[] };
};

function ranking<K extends string>(
	key: K,
	label: string,
	name: string,
	digits: number,
	get: (ranking: Ranking) => number,
	title?: string
): RankingColumn & { key: K } {
	return { key, label, name, title, source: 'ranking', digits, value: (row) => get(row.ranking) };
}

function score<K extends string>(
	key: K,
	label: string,
	name: string,
	title: string,
	digits: number,
	get: (scores: ScoreStats) => number
): RankingColumn & { key: K } {
	return {
		key,
		label,
		name,
		title,
		source: 'score',
		digits,
		value: (row) => (row.scores ? get(row.scores) : null),
		csv: {
			header: [label.startsWith('NP') ? label : `NP ${label.toLowerCase()}`],
			values: (row) => [row.scores ? get(row.scores) : null]
		}
	};
}

const OPR_TITLE = 'Offensive power rating, estimated points per match';

function rating<K extends string>(
	key: K,
	label: string,
	name: string,
	digits: number,
	get: (rating: TeamRating) => number
): RankingColumn & { key: K } {
	return {
		key,
		label,
		name,
		title: key === 'opr' ? OPR_TITLE : `${OPR_TITLE} from ${name.toLowerCase()}`,
		source: 'rating',
		digits,
		value: (row) => (row.rating ? get(row.rating) : null)
	};
}

function winShare(row: Ranking): number {
	const games = row.wins + row.losses + row.ties;
	return games > 0 ? (row.wins + row.ties / 2) / games : 0;
}

export const RANKING_COLUMNS = [
	ranking(
		'rs',
		'RS',
		'Ranking score (RS)',
		2,
		(row) => row.rs,
		'Ranking score, average ranking points per match'
	),
	{
		...ranking('record', 'Record', 'Record', 0, winShare),
		text: (row: RankingRow) => record(row.ranking.wins, row.ranking.losses, row.ranking.ties),
		csv: {
			header: ['Wins', 'Losses', 'Ties'],
			values: (row: RankingRow) => [row.ranking.wins, row.ranking.losses, row.ranking.ties]
		}
	},
	ranking('played', 'Played', 'Matches played', 0, (row) => row.played),
	ranking(
		'tbp',
		'TBP',
		'Tiebreaker (TBP)',
		1,
		(row) => row.tbp,
		'Tiebreaker points, average match score without penalties'
	),
	score(
		'npavg',
		'NP avg',
		'Average',
		'Average score without opponent fouls',
		1,
		(stats) => stats.avg
	),
	score('npmax', 'NP max', 'Best', 'Best score without opponent fouls', 0, (stats) => stats.max),
	score('npmin', 'NP min', 'Worst', 'Worst score without opponent fouls', 0, (stats) => stats.min),
	score(
		'npsd',
		'Spread',
		'Spread',
		'Standard deviation of scores without opponent fouls',
		1,
		(stats) => stats.sd
	),
	ranking('avgtips', 'Avg tips', 'Average tips', 1, (row) => row.avgTips, 'Average tips per match'),
	rating('opr', 'OPR', 'Total', 1, (row) => row.opr),
	rating('opr-auto', `${PART_LABELS.auto} OPR`, PART_LABELS.auto, 1, (row) => row.parts.auto),
	rating(
		'opr-teleop',
		`${PART_LABELS.teleop} OPR`,
		PART_LABELS.teleop,
		1,
		(row) => row.opr - row.parts.auto
	),
	rating('opr-hive', `${PART_LABELS.hive} OPR`, PART_LABELS.hive, 1, (row) => row.parts.hive),
	rating(
		'opr-flower',
		`${PART_LABELS.flower} OPR`,
		PART_LABELS.flower,
		1,
		(row) => row.parts.flower
	),
	rating(
		'opr-garden',
		`${PART_LABELS.garden} OPR`,
		PART_LABELS.garden,
		1,
		(row) => row.parts.garden
	),
	rating('opr-park', `${PART_LABELS.park} OPR`, PART_LABELS.park, 1, (row) => row.parts.park),
	rating('opr-tips', `${PART_LABELS.tips} OPR`, PART_LABELS.tips, 2, (row) => row.parts.tips)
] as const satisfies readonly RankingColumn[];

export type ColumnKey = (typeof RANKING_COLUMNS)[number]['key'];

export const COLUMN_GROUPS: { source: ColumnSource; label: string }[] = [
	{ source: 'ranking', label: 'Rankings' },
	{ source: 'score', label: 'Scores' },
	{ source: 'rating', label: 'OPR' }
];

export const DEFAULT_COLUMNS: ColumnKey[] = ['rs', 'record', 'tbp', 'npmax', 'avgtips', 'opr'];

const PHONE_HIDDEN = new Set<ColumnKey>(['tbp', 'npmax', 'avgtips']);

const EXTRA_SORTS = ['rank', 'team', 'finish', 'top4', 'top8'] as const;

export type SortKey = ColumnKey | (typeof EXTRA_SORTS)[number];

export type SortDir = 'asc' | 'desc';

export type RankingChoice = { columns: ColumnKey[]; sort: SortKey; dir: SortDir };

export const DEFAULT_CHOICE: RankingChoice = { columns: DEFAULT_COLUMNS, sort: 'rank', dir: 'asc' };

const BY_KEY = new Map<string, RankingColumn>(
	RANKING_COLUMNS.map((column) => [column.key, column])
);

const ASCENDING = new Set<SortKey>(['rank', 'team', 'finish']);

const PARAMS = ['cols', 'sort', 'dir'];

export function columnOf(key: ColumnKey): RankingColumn {
	return BY_KEY.get(key) as RankingColumn;
}

function isColumn(key: string): key is ColumnKey {
	return BY_KEY.has(key);
}

function isSort(key: string): key is SortKey {
	return isColumn(key) || (EXTRA_SORTS as readonly string[]).includes(key);
}

export function defaultDir(sort: SortKey): SortDir {
	return ASCENDING.has(sort) ? 'asc' : 'desc';
}

function ordered(keys: Iterable<string>): ColumnKey[] {
	const wanted = new Set(keys);
	return RANKING_COLUMNS.map((column) => column.key).filter((key) => wanted.has(key));
}

function normalize(choice: RankingChoice): RankingChoice {
	const columns = ordered(choice.columns);
	const sort = isColumn(choice.sort) && !columns.includes(choice.sort) ? 'rank' : choice.sort;
	const dir = sort === choice.sort ? choice.dir : defaultDir(sort);
	return { columns, sort, dir };
}

export function hasChoice(params: Pick<URLSearchParams, 'has'>): boolean {
	return PARAMS.some((name) => params.has(name));
}

export function parseRankingChoice(params: Pick<URLSearchParams, 'get'>): RankingChoice {
	const cols = params.get('cols');
	const columns = cols === null ? DEFAULT_COLUMNS : cols.split(',').filter(isColumn);
	const rawSort = params.get('sort') ?? '';
	const sort = isSort(rawSort) ? rawSort : 'rank';
	const rawDir = params.get('dir');
	const dir = rawDir === 'asc' || rawDir === 'desc' ? rawDir : defaultDir(sort);
	return normalize({ columns, sort, dir });
}

export function isDefaultColumns(columns: readonly ColumnKey[]): boolean {
	return ordered(columns).join(',') === DEFAULT_COLUMNS.join(',');
}

export function rankingQuery(choice: RankingChoice): string {
	const { columns, sort, dir } = normalize(choice);
	const parts: string[] = [];
	if (!isDefaultColumns(columns)) parts.push(`cols=${columns.join(',')}`);
	if (sort !== 'rank') parts.push(`sort=${sort}`);
	if (dir !== defaultDir(sort)) parts.push(`dir=${dir}`);
	return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function toggleColumn(choice: RankingChoice, key: ColumnKey, on: boolean): RankingChoice {
	const columns = on ? [...choice.columns, key] : choice.columns.filter((column) => column !== key);
	return normalize({ ...choice, columns });
}

export function sortBy(choice: RankingChoice, sort: SortKey): RankingChoice {
	if (choice.sort === sort) {
		return { ...choice, dir: choice.dir === 'asc' ? 'desc' : 'asc' };
	}
	return normalize({ ...choice, sort, dir: defaultDir(sort) });
}

export function phoneHidden(key: ColumnKey, choice: RankingChoice, projected: boolean): boolean {
	if (key === choice.sort || !isDefaultColumns(choice.columns)) return false;
	return PHONE_HIDDEN.has(key) || (key === 'record' && projected);
}

export function scoreStats(matches: Match[]): Map<number, ScoreStats> {
	const scores = new Map<number, number[]>();
	for (const match of matches) {
		if (match.level !== 'qual' || !match.result) continue;
		for (const color of ['red', 'blue'] as const) {
			const value = match.result[color].preFoulTotal;
			for (const entry of match[color]) {
				if (entry.noShow) continue;
				const list = scores.get(entry.team) ?? [];
				list.push(value);
				scores.set(entry.team, list);
			}
		}
	}
	const stats = new Map<number, ScoreStats>();
	for (const [team, list] of scores) {
		const avg = list.reduce((sum, value) => sum + value, 0) / list.length;
		const variance = list.reduce((sum, value) => sum + (value - avg) ** 2, 0) / list.length;
		stats.set(team, {
			avg,
			max: Math.max(...list),
			min: Math.min(...list),
			sd: Math.sqrt(variance),
			count: list.length
		});
	}
	return stats;
}

export function availableSources(
	ratings: readonly TeamRating[] | null,
	stats: ReadonlyMap<number, ScoreStats>
): Set<ColumnSource> {
	const sources = new Set<ColumnSource>(['ranking']);
	if (stats.size > 0) sources.add('score');
	if (ratings && ratings.length > 0) sources.add('rating');
	return sources;
}

export function visibleColumns(
	choice: RankingChoice,
	sources: ReadonlySet<ColumnSource>
): RankingColumn[] {
	return choice.columns.map(columnOf).filter((column) => sources.has(column.source));
}

export function rankingRows(
	rankings: Ranking[],
	ratings: readonly TeamRating[] | null,
	stats: ReadonlyMap<number, ScoreStats>,
	projections: readonly Projection[] | null
): RankingRow[] {
	const rated = new Map(ratings?.map((item) => [item.team, item]));
	const projected = new Map(projections?.map((item) => [item.team, item]));
	return rankings.map((row) => ({
		ranking: row,
		rating: rated.get(row.team) ?? null,
		scores: stats.get(row.team) ?? null,
		projection: projected.get(row.team) ?? null
	}));
}

export function sortValue(row: RankingRow, sort: SortKey): number | null {
	switch (sort) {
		case 'rank':
			return row.ranking.rank;
		case 'team':
			return row.ranking.team;
		case 'finish':
			return row.projection?.expectedRank ?? null;
		case 'top4':
			return row.projection?.top4 ?? null;
		case 'top8':
			return row.projection?.top8 ?? null;
		default:
			return columnOf(sort).value(row);
	}
}

export function sortRankingRows(rows: RankingRow[], choice: Pick<RankingChoice, 'sort' | 'dir'>) {
	const sign = choice.dir === 'asc' ? 1 : -1;
	return rows
		.map((row) => ({ row, value: sortValue(row, choice.sort) }))
		.sort((a, b) => {
			if (a.value === null || b.value === null) {
				if (a.value !== b.value) return a.value === null ? 1 : -1;
			} else if (a.value !== b.value) {
				return (a.value - b.value) * sign;
			}
			return a.row.ranking.rank - b.row.ranking.rank;
		})
		.map(({ row }) => row);
}

export function cellText(column: RankingColumn, row: RankingRow): string {
	return column.text ? column.text(row) : fixed(column.value(row), column.digits);
}

export function csvHeader(columns: RankingColumn[]): string[] {
	return columns.flatMap((column) => column.csv?.header ?? [column.label]);
}

export function csvValues(columns: RankingColumn[], row: RankingRow): (number | null)[] {
	return columns.flatMap((column) => column.csv?.values(row) ?? [column.value(row)]);
}

export function csvDigits(columns: RankingColumn[]): number[] {
	return columns.flatMap((column) =>
		column.csv ? column.csv.header.map(() => column.digits) : [column.digits]
	);
}
