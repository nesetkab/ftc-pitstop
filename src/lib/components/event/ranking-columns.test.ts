import { describe, expect, it } from 'vitest';
import { npMax } from './insights.ts';
import {
	availableSources,
	cellText,
	columnOf,
	csvDigits,
	csvHeader,
	csvValues,
	DEFAULT_CHOICE,
	DEFAULT_COLUMNS,
	hasChoice,
	parseRankingChoice,
	parseRankingView,
	phoneHidden,
	rankingPageQuery,
	rankingQuery,
	rankingRows,
	scoreStats,
	sortBy,
	sortRankingRows,
	toggleColumn,
	visibleColumns,
	type RankingChoice
} from './ranking-columns.ts';
import { fakeAnalysis, fixtureBundle } from './test-fixtures.ts';

const bundle = fixtureBundle('USAZGIQ');
const analysis = fakeAnalysis(bundle);
const stats = scoreStats(bundle.matches);

function parse(query: string) {
	return parseRankingChoice(new URLSearchParams(query));
}

function rows() {
	return rankingRows(bundle.rankings, analysis.ratings, stats, analysis.projections);
}

describe('parseRankingChoice', () => {
	it('falls back to the default columns and rank order', () => {
		expect(parse('')).toEqual(DEFAULT_CHOICE);
		expect(hasChoice(new URLSearchParams(''))).toBe(false);
		expect(hasChoice(new URLSearchParams('sort=opr'))).toBe(true);
	});

	it('reads columns in display order and drops unknown keys', () => {
		expect(parse('cols=opr-auto,rs,bogus,rs,npsd').columns).toEqual(['rs', 'npsd', 'opr-auto']);
		expect(parse('cols=').columns).toEqual([]);
	});

	it('reads the sort and its direction', () => {
		expect(parse('sort=opr')).toMatchObject({ sort: 'opr', dir: 'desc' });
		expect(parse('sort=opr&dir=asc')).toMatchObject({ sort: 'opr', dir: 'asc' });
		expect(parse('sort=team')).toMatchObject({ sort: 'team', dir: 'asc' });
		expect(parse('sort=top8&dir=sideways')).toMatchObject({ sort: 'top8', dir: 'desc' });
		expect(parse('sort=nope')).toMatchObject({ sort: 'rank', dir: 'asc' });
	});

	it('drops a sort on a column that is not shown', () => {
		expect(parse('cols=rs,opr&sort=opr-auto&dir=asc')).toMatchObject({ sort: 'rank', dir: 'asc' });
	});
});

describe('rankingQuery', () => {
	it('leaves defaults out of the URL', () => {
		expect(rankingQuery(DEFAULT_CHOICE)).toBe('');
		expect(rankingQuery({ ...DEFAULT_CHOICE, sort: 'opr', dir: 'desc' })).toBe('?sort=opr');
		expect(rankingQuery({ ...DEFAULT_CHOICE, sort: 'rank', dir: 'desc' })).toBe('?dir=desc');
	});

	it('round trips a custom choice', () => {
		const choice: RankingChoice = {
			columns: ['opr-tips', 'rs', 'npavg'],
			sort: 'npavg',
			dir: 'asc'
		};
		const query = rankingQuery(choice);
		expect(query).toBe('?cols=rs,npavg,opr-tips&sort=npavg&dir=asc');
		expect(parse(query.slice(1))).toEqual({ ...choice, columns: ['rs', 'npavg', 'opr-tips'] });
	});
});

describe('ranking views', () => {
	it('reads the view and falls back to standings', () => {
		expect(parseRankingView(new URLSearchParams('view=rp'))).toBe('rp');
		expect(parseRankingView(new URLSearchParams('view=schedule&sort=opr'))).toBe('schedule');
		expect(parseRankingView(new URLSearchParams('view=standings'))).toBe('standings');
		expect(parseRankingView(new URLSearchParams('view=bogus'))).toBe('standings');
		expect(parseRankingView(new URLSearchParams(''))).toBe('standings');
	});

	it('keeps the columns and sort when the view changes', () => {
		const choice = parse('sort=opr&dir=asc');
		expect(rankingPageQuery(choice, 'standings')).toBe('?sort=opr&dir=asc');
		expect(rankingPageQuery(choice, 'rp')).toBe('?sort=opr&dir=asc&view=rp');
		expect(rankingPageQuery(DEFAULT_CHOICE, 'schedule')).toBe('?view=schedule');
		expect(rankingPageQuery(DEFAULT_CHOICE, 'standings')).toBe('');
	});

	it('does not count the view as a column choice', () => {
		expect(hasChoice(new URLSearchParams('view=rp'))).toBe(false);
		expect(parse('view=rp')).toEqual(DEFAULT_CHOICE);
	});
});

describe('toggleColumn and sortBy', () => {
	it('adds and removes columns in display order', () => {
		const added = toggleColumn(DEFAULT_CHOICE, 'opr-auto', true);
		expect(added.columns).toEqual([...DEFAULT_COLUMNS, 'opr-auto']);
		expect(toggleColumn(added, 'played', true).columns.indexOf('played')).toBe(2);
		expect(toggleColumn(added, 'rs', false).columns).not.toContain('rs');
	});

	it('resets the sort when its column is removed', () => {
		const sorted = sortBy(DEFAULT_CHOICE, 'opr');
		expect(toggleColumn(sorted, 'opr', false)).toMatchObject({ sort: 'rank', dir: 'asc' });
	});

	it('flips the direction on a second click', () => {
		const once = sortBy(DEFAULT_CHOICE, 'tbp');
		expect(once).toMatchObject({ sort: 'tbp', dir: 'desc' });
		expect(sortBy(once, 'tbp')).toMatchObject({ sort: 'tbp', dir: 'asc' });
		expect(sortBy(DEFAULT_CHOICE, 'rank')).toMatchObject({ sort: 'rank', dir: 'desc' });
	});
});

describe('scoreStats', () => {
	it('summarizes each team’s qualification scores without opponent fouls', () => {
		const best = npMax(bundle.matches);
		for (const [team, row] of stats) {
			expect(row.max).toBe(best.get(team));
			expect(row.min).toBeLessThanOrEqual(row.avg);
			expect(row.avg).toBeLessThanOrEqual(row.max);
			expect(row.sd).toBeGreaterThanOrEqual(0);
		}
		expect(stats.get(26670)?.count).toBe(5);
	});

	it('works out the spread', () => {
		const match = bundle.matches.find((item) => item.level === 'qual' && item.result)!;
		const solo = scoreStats([
			match,
			{
				...match,
				key: 'copy',
				result: {
					...match.result!,
					red: { ...match.result!.red, preFoulTotal: match.result!.red.preFoulTotal + 20 }
				}
			}
		]);
		const team = match.red[0].team;
		expect(solo.get(team)).toMatchObject({ count: 2, sd: 10 });
	});
});

describe('columns', () => {
	it('only offers OPR and score columns when the data is there', () => {
		expect([...availableSources(null, new Map())]).toEqual(['ranking']);
		expect([...availableSources(analysis.ratings, stats)].sort()).toEqual([
			'ranking',
			'rating',
			'score'
		]);
		const all = parse('cols=rs,npavg,opr-auto');
		expect(visibleColumns(all, availableSources(null, stats)).map((column) => column.key)).toEqual([
			'rs',
			'npavg'
		]);
	});

	it('formats cells and works out teleop OPR', () => {
		const row = rows()[0];
		expect(cellText(columnOf('record'), row)).toBe('5-0-0');
		expect(cellText(columnOf('opr-teleop'), row)).toBe('48.0');
		expect(cellText(columnOf('opr-tips'), row)).toBe('1.25');
		expect(cellText(columnOf('rs'), row)).toBe('4.40');
	});

	it('hides low-value default columns on phones unless the viewer chose them', () => {
		expect(phoneHidden('tbp', DEFAULT_CHOICE, false)).toBe(true);
		expect(phoneHidden('record', DEFAULT_CHOICE, false)).toBe(false);
		expect(phoneHidden('record', DEFAULT_CHOICE, true)).toBe(true);
		expect(phoneHidden('tbp', sortBy(DEFAULT_CHOICE, 'tbp'), false)).toBe(false);
		expect(phoneHidden('tbp', toggleColumn(DEFAULT_CHOICE, 'opr-auto', true), false)).toBe(false);
	});

	it('expands the record into wins, losses and ties for CSV', () => {
		const columns = visibleColumns(
			parse('cols=record,npsd,opr'),
			availableSources(analysis.ratings, stats)
		);
		expect(csvHeader(columns)).toEqual(['Wins', 'Losses', 'Ties', 'NP spread', 'OPR']);
		expect(csvDigits(columns)).toEqual([0, 0, 0, 1, 1]);
		expect(csvValues(columns, rows()[0]).slice(0, 3)).toEqual([5, 0, 0]);
	});
});

describe('sortRankingRows', () => {
	it('keeps rank order by default', () => {
		const sorted = sortRankingRows(rows(), DEFAULT_CHOICE);
		expect(sorted.map((row) => row.ranking.rank)).toEqual(bundle.rankings.map((row) => row.rank));
	});

	it('sorts by a stat in either direction', () => {
		const down = sortRankingRows(rows(), { sort: 'npmax', dir: 'desc' });
		const values = down.map((row) => row.scores?.max ?? -1);
		expect(values).toEqual([...values].sort((a, b) => b - a));
		const up = sortRankingRows(rows(), { sort: 'npmax', dir: 'asc' });
		expect(up[0].scores?.max).toBe(Math.min(...values.filter((value) => value >= 0)));
	});

	it('breaks ties by rank', () => {
		const sorted = sortRankingRows(rows(), { sort: 'opr-auto', dir: 'desc' });
		expect(sorted.map((row) => row.ranking.rank)).toEqual(bundle.rankings.map((row) => row.rank));
	});

	it('puts missing values last whichever way it sorts', () => {
		const partial = rankingRows(bundle.rankings, analysis.ratings.slice(3), stats, null);
		for (const dir of ['asc', 'desc'] as const) {
			const sorted = sortRankingRows(partial, { sort: 'opr', dir });
			expect(sorted.slice(-3).every((row) => row.rating === null)).toBe(true);
		}
	});

	it('sorts by team number and projected finish', () => {
		const byTeam = sortRankingRows(rows(), { sort: 'team', dir: 'asc' });
		expect(byTeam[0].ranking.team).toBe(Math.min(...bundle.rankings.map((row) => row.team)));
		const byFinish = sortRankingRows(rows(), { sort: 'finish', dir: 'asc' });
		expect(byFinish[0].projection?.expectedRank).toBe(1);
	});
});
