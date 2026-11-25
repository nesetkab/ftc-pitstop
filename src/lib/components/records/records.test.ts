import { describe, expect, it } from 'vitest';
import type { SeasonMatch, SeasonMatchAlliance } from '#lib/types.ts';
import {
	buildRecordDataset,
	clearedRecords,
	hasRecordFilters,
	filterRecords,
	parseCondition,
	recordColumns,
	RECORD_COLUMNS,
	pageRecords,
	parseRecordFilters,
	recordQuery,
	recordSummary,
	type RecordFilters
} from './records.ts';

function alliance(teams: number[], total: number, overrides: Partial<SeasonMatchAlliance> = {}) {
	return {
		teams,
		surrogates: [],
		noShows: [],
		dqs: [],
		total,
		preFoulTotal: total,
		auto: 20,
		teleop: total - 20,
		hive: total - 30,
		flower: 4,
		garden: 2,
		park: 4,
		foulPoints: 0,
		tips: 3,
		leavePark: 9,
		robots: [3, 3],
		rp: { swarm: false, pollinator1: false, pollinator2: false },
		...overrides
	};
}

function seasonMatch(
	key: string,
	red: SeasonMatchAlliance,
	blue: SeasonMatchAlliance,
	overrides: Partial<SeasonMatch> = {}
): SeasonMatch {
	return {
		eventCode: 'USAZGIQ',
		eventType: 'Qualifier',
		region: 'USAZ',
		date: '2026-11-14',
		end: '2026-11-14',
		time: Date.parse('2026-11-14T18:00:00Z'),
		key,
		level: key.startsWith('q') ? 'qual' : 'playoff',
		series: 0,
		number: Number(key.slice(1)),
		red,
		blue,
		...overrides
	};
}

const filters = (overrides: Partial<RecordFilters> = {}): RecordFilters => ({
	...parseRecordFilters(new URLSearchParams()),
	...overrides
});

const matches = [
	seasonMatch('q1', alliance([1, 2], 150, { total: 160 }), alliance([3, 4], 120)),
	seasonMatch('p2', alliance([1, 3], 200, { auto: 50, teleop: 150 }), alliance([2, 4], 200), {
		date: '2026-11-21',
		end: '2026-11-21',
		time: Date.parse('2026-11-21T20:00:00Z'),
		region: 'USCALA',
		eventCode: 'USCALAQ',
		eventType: 'LeagueMeet'
	}),
	seasonMatch('q3', alliance([5], 90), alliance([], 0))
];

describe('parseRecordFilters', () => {
	it('falls back to safe defaults for unknown values', () => {
		expect(
			parseRecordFilters(
				new URLSearchParams(
					'part=bogus&dir=up&range=9&region=<x>&type=Bogus&level=x&team=abc&show=x&match=any&f=x&page=-3'
				)
			)
		).toEqual({
			part: 'total',
			dir: 'desc',
			range: 'all',
			region: '',
			type: '',
			level: '',
			team: null,
			match: 'all',
			where: [],
			page: 1
		});
	});

	it('reads sort order and custom filters and writes them back', () => {
		const query = 'part=margin&dir=asc&match=any&f=hive.gt.100&f=auto.lt.teleop&f=margin.lte.-5';
		const parsed = parseRecordFilters(new URLSearchParams(query));
		expect(parsed).toMatchObject({
			part: 'margin',
			dir: 'asc',
			match: 'any',
			where: [
				{ stat: 'hive', op: 'gt', value: 100 },
				{ stat: 'auto', op: 'lt', value: 'teleop' },
				{ stat: 'margin', op: 'lte', value: -5 }
			]
		});
		expect(recordQuery(parsed)).toBe(`?${query}`);
	});

	it('drops broken conditions and a lone any', () => {
		for (const text of ['hive.gt.x', 'hive.gt.hive', 'bogus.gt.1', 'hive.zz.1', 'hive.gt.99999']) {
			expect(parseCondition(text)).toBeNull();
		}
		const lone = parseRecordFilters(new URLSearchParams('match=any&f=hive.gt.1'));
		expect(lone.match).toBe('all');
		const many = new URLSearchParams(Array.from({ length: 12 }, () => ['f', 'total.gt.1']));
		expect(parseRecordFilters(many).where).toHaveLength(8);
	});

	it('always shows the sorted statistic', () => {
		expect(recordColumns('park')).toEqual(RECORD_COLUMNS);
		expect(recordColumns('margin')).toEqual(['margin', ...RECORD_COLUMNS]);
	});

	it('reads every filter and builds the same query back', () => {
		const query = 'part=auto&range=7&region=usaz&type=Qualifier&level=qual&team=19666&page=2';
		const parsed = parseRecordFilters(new URLSearchParams(query));
		expect(parsed).toMatchObject({ part: 'auto', region: 'USAZ', team: 19666, page: 2 });
		expect(recordQuery(parsed)).toBe(`?${query.replace('usaz', 'USAZ')}`);
		expect(recordQuery(parsed, 1)).not.toContain('page');
		expect(recordQuery(filters())).toBe('');
	});
});

describe('buildRecordDataset', () => {
	it('adds one row per alliance and skips matches missing a side', () => {
		const { rows, regions, types } = buildRecordDataset(matches);
		expect(rows).toHaveLength(4);
		const first = rows[0];
		expect(first).toMatchObject({
			event: 'USAZGIQ',
			label: 'Q1',
			alliance: 'red',
			teams: [1, 2],
			opponents: [3, 4],
			total: 150,
			opponent: 120,
			result: 'win',
			final: 160,
			fouls: 0,
			margin: 30
		});
		expect(rows[1]).toMatchObject({ alliance: 'blue', result: 'loss', label: 'Q1' });
		expect(rows[2]).toMatchObject({ label: 'M2', result: 'tie', day: '2026-11-21' });
		expect(regions.map((option) => option.value)).toEqual(['USAZ', 'USCALA']);
		expect(types.map((option) => option.label)).toEqual(['League meet', 'Qualifier']);
	});

	it('keeps the match day inside the event dates', () => {
		const late = seasonMatch('q1', alliance([1], 10), alliance([2], 5), {
			time: Date.parse('2026-11-15T03:00:00Z')
		});
		expect(buildRecordDataset([late]).rows[0].day).toBe('2026-11-14');
	});

	it('skips matches with impossible scores', () => {
		const junk = seasonMatch('q1', alliance([1], 7308), alliance([2], 80));
		const broken = seasonMatch('q2', alliance([1], 90, { auto: 80 }), alliance([2], 80));
		expect(buildRecordDataset([junk, broken]).rows).toHaveLength(0);
	});
});

describe('filterRecords', () => {
	const { rows } = buildRecordDataset(matches);

	it('sorts by the chosen part and breaks ties by total', () => {
		expect(filterRecords(rows, filters(), '2026-11-22').map((row) => row.total)).toEqual([
			200, 200, 150, 120
		]);
		const auto = filterRecords(rows, filters({ part: 'auto' }), '2026-11-22');
		expect(auto[0]).toMatchObject({ auto: 50, teams: [1, 3] });
		expect(auto.slice(1).map((row) => row.total)).toEqual([200, 150, 120]);
	});

	it('sorts low to high when asked', () => {
		const low = filterRecords(rows, filters({ dir: 'asc' }), '2026-11-22');
		expect(low.map((row) => row.total)).toEqual([120, 150, 200, 200]);
		const margin = filterRecords(rows, filters({ part: 'margin', dir: 'asc' }), '2026-11-22');
		expect(margin.map((row) => row.margin)).toEqual([-30, 0, 0, 30]);
	});

	it('keeps scores that meet all or any custom filters', () => {
		const today = '2026-11-22';
		const high = filters({ where: [{ stat: 'total', op: 'gte', value: 150 }] });
		expect(filterRecords(rows, high, today)).toHaveLength(3);
		const both = filters({
			where: [
				{ stat: 'total', op: 'lt', value: 130 },
				{ stat: 'auto', op: 'gt', value: 40 }
			]
		});
		expect(filterRecords(rows, both, today)).toHaveLength(0);
		expect(filterRecords(rows, { ...both, match: 'any' }, today).map((row) => row.total)).toEqual([
			200, 120
		]);
		const ahead = filters({ where: [{ stat: 'auto', op: 'eq', value: 'teleop' }] });
		expect(filterRecords(rows, ahead, today)).toHaveLength(0);
		const winning = filters({ where: [{ stat: 'margin', op: 'gt', value: 0 }] });
		expect(filterRecords(rows, winning, today).map((row) => row.total)).toEqual([150]);
	});

	it('filters by dates, region, type, level and team', () => {
		const today = '2026-11-22';
		expect(filterRecords(rows, filters({ range: '7' }), today)).toHaveLength(2);
		expect(filterRecords(rows, filters({ range: '30' }), today)).toHaveLength(4);
		expect(filterRecords(rows, filters({ region: 'USAZ' }), today)).toHaveLength(2);
		expect(filterRecords(rows, filters({ type: 'LeagueMeet' }), today)).toHaveLength(2);
		expect(filterRecords(rows, filters({ level: 'playoff' }), today)).toHaveLength(2);
		expect(
			filterRecords(rows, filters({ team: 3 }), today).map((row) => row.teams.join('+'))
		).toEqual(['1+3', '3+4']);
	});
});

describe('pageRecords', () => {
	const { rows } = buildRecordDataset(matches);
	const sorted = filterRecords(rows, filters(), '2026-11-22');

	it('gives tied scores the same rank', () => {
		expect(pageRecords(sorted, 'total', 1).rows.map((row) => row.rank)).toEqual([1, 1, 3, 4]);
	});

	it('carries a tie across a page break', () => {
		const second = pageRecords(sorted, 'total', 2, 1);
		expect(second).toMatchObject({ page: 2, pages: 4, start: 1, total: 4 });
		expect(second.rows[0].rank).toBe(1);
		expect(pageRecords(sorted, 'total', 99, 3)).toMatchObject({ page: 2, start: 3 });
	});
});

describe('recordSummary', () => {
	const options = {
		regions: [{ value: 'USAZ', label: 'Arizona' }],
		types: [{ value: 'Qualifier', label: 'Qualifier' }]
	};
	const plain = parseRecordFilters(new URLSearchParams());

	it('says nothing for the default view', () => {
		expect(recordSummary(plain, options)).toEqual([]);
	});

	it('names each active filter and a sort other than total', () => {
		expect(
			recordSummary(
				parseRecordFilters(
					new URLSearchParams('range=7&region=USAZ&type=Qualifier&level=playoff&team=724&part=auto')
				),
				options
			)
		).toEqual(['Last 7 days', 'Arizona', 'Qualifier', 'Playoffs only', 'Team 724', 'By auto']);
	});

	it('names custom filters and a low to high sort', () => {
		expect(
			recordSummary(
				parseRecordFilters(
					new URLSearchParams('dir=asc&match=any&f=hive.gte.100&f=auto.gt.teleop')
				),
				options
			)
		).toEqual(['Any of Hive ≥ 100, Auto > Teleop', 'By total, low to high']);
	});
});

describe('clearing record filters', () => {
	it('treats the sort as a view, not a filter, and keeps it when clearing', () => {
		const sorted = parseRecordFilters(new URLSearchParams('part=auto'));
		expect(hasRecordFilters(sorted)).toBe(false);
		const filtered = parseRecordFilters(new URLSearchParams('part=auto&range=7'));
		expect(hasRecordFilters(filtered)).toBe(true);
		expect(clearedRecords(filtered)).toBe('/records?part=auto');
		expect(clearedRecords(parseRecordFilters(new URLSearchParams('team=724')))).toBe('/records');
	});

	it('counts custom filters as filters and clears them but keeps the view', () => {
		const custom = parseRecordFilters(new URLSearchParams('part=hive&dir=asc&f=auto.gt.10'));
		expect(hasRecordFilters(custom)).toBe(true);
		expect(clearedRecords(custom)).toBe('/records?part=hive&dir=asc');
	});
});
