import { describe, expect, it } from 'vitest';
import {
	eventRecordRows,
	insightQuery,
	npMax,
	parseInsightFilters,
	partAverages,
	partHighs,
	rankInsights,
	sortInsights
} from './insights.ts';
import { fixtureBundle } from './test-fixtures.ts';

const bundle = fixtureBundle('USAZGIQ');
const rows = eventRecordRows(bundle.event, bundle.matches);

describe('insight filters', () => {
	it('falls back to total, all levels and the short list', () => {
		expect(parseInsightFilters(new URLSearchParams('sort=bogus&level=x'))).toEqual({
			sort: 'total',
			level: '',
			all: false
		});
		expect(parseInsightFilters(new URLSearchParams('sort=tips&level=playoff&all=1'))).toEqual({
			sort: 'tips',
			level: 'playoff',
			all: true
		});
	});

	it('writes only the filters that differ from the defaults', () => {
		expect(insightQuery({ sort: 'total', level: '', all: false })).toBe('');
		expect(insightQuery({ sort: 'hive', level: 'qual', all: true })).toBe(
			'?sort=hive&level=qual&all=1'
		);
	});
});

describe('eventRecordRows', () => {
	it('makes one row per alliance with parts from the breakdown', () => {
		const played = bundle.matches.filter((match) => match.result).length;
		expect(rows).toHaveLength(played * 2);
		const top = rows.find((row) => row.key === 'p10' && row.alliance === 'red');
		expect(top).toMatchObject({
			teams: [18420, 25620],
			opponents: [26670, 18421],
			result: 'win',
			total: 178,
			opponent: 81,
			auto: 36,
			teleop: 142,
			hive: 130,
			garden: 2,
			park: 10,
			tips: 7,
			day: '2026-11-14'
		});
	});
});

describe('sorting and ranking', () => {
	it('sorts by the chosen part, filters by level and shares ranks on ties', () => {
		const filters = parseInsightFilters(new URLSearchParams('level=qual'));
		const ranked = rankInsights(sortInsights(rows, filters), filters.sort);
		expect(ranked.every((row) => row.level === 'qual')).toBe(true);
		expect(ranked.slice(0, 3).map((row) => [row.rank, row.total])).toEqual([
			[1, 114],
			[1, 114],
			[3, 110]
		]);
	});

	it('breaks ties by total', () => {
		const sorted = sortInsights(rows, parseInsightFilters(new URLSearchParams('sort=park')));
		expect(sorted[0].park).toBe(10);
		expect(sorted[0].total).toBe(178);
	});
});

describe('averages and highs', () => {
	it('averages every part and keeps the count', () => {
		const averages = partAverages(rows)!;
		expect(averages.count).toBe(rows.length);
		expect(averages.total).toBeCloseTo(averages.auto + averages.teleop, 6);
		expect(partHighs(rows)).toMatchObject({ total: 178, hive: 130, tips: 7 });
		expect(partAverages([])).toBeNull();
		expect(partHighs([])).toBeNull();
	});
});

describe('npMax', () => {
	it('keeps the best qualification score without opponent fouls for each team', () => {
		const best = npMax(bundle.matches);
		expect(best.get(26670)).toBe(110);
		expect(best.get(18420)).toBe(114);
	});

	it('skips no-shows and playoff matches', () => {
		const [first] = bundle.matches.filter((match) => match.level === 'qual' && match.result);
		const absent = { ...first, red: first.red.map((entry) => ({ ...entry, noShow: true })) };
		const playoff = bundle.matches.filter((match) => match.level === 'playoff');
		const best = npMax([absent, ...playoff]);
		expect([...best.keys()].sort()).toEqual(first.blue.map((entry) => entry.team).sort());
	});
});
