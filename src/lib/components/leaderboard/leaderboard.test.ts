import { describe, expect, it } from 'vitest';
import type { SeasonEventRatings, SeasonRating, SeasonRatings } from '#lib/analysis/types.ts';
import {
	PAGE_SIZE,
	buildRatingRows,
	createDataset,
	dateWindow,
	datesChoice,
	eventFilterOptions,
	filterSummary,
	filterRows,
	isScoped,
	leaderboardScope,
	matchesType,
	scopeRows,
	typeLabel,
	windowLabel,
	paginate,
	parseFilters,
	matchesQuery,
	normalizeText,
	queryString,
	teamPage,
	withSelectedType,
	type LeaderboardFilters,
	type LeaderboardRow
} from './leaderboard.ts';

const none: LeaderboardFilters = {
	region: '',
	country: '',
	state: '',
	min: 0,
	sort: 'opr',
	q: '',
	team: 0,
	page: 1,
	type: '',
	dates: '',
	from: '',
	to: ''
};

function row(team: number, opr: number, overrides: Partial<LeaderboardRow> = {}): LeaderboardRow {
	return {
		team,
		name: `Team ${team}`,
		city: 'Phoenix',
		state: 'AZ',
		country: 'USA',
		region: 'USAZ',
		opr,
		auto: opr / 4,
		teleop: (opr * 3) / 4,
		tips: 2,
		matches: 10,
		events: 2,
		...overrides
	};
}

const rows: LeaderboardRow[] = [
	row(1, 30),
	row(2, 90),
	row(3, 60, { region: 'USCALA', state: 'CA', city: 'Los Angeles' }),
	row(4, 60, { matches: 3 }),
	row(5, 75, { country: 'Canada', state: 'ON', region: 'CAON', city: 'Toronto' }),
	row(6, 10, { country: 'China', state: 'SH', region: 'CN', city: 'Shanghai' }),
	row(7, 50, { matches: 0 })
];

describe('parseFilters', () => {
	it('reads filters from the query string', () => {
		const params = new URLSearchParams('region=usaz&country=USA&state=AZ&min=10&page=3');
		expect(parseFilters(params)).toEqual({
			region: 'USAZ',
			country: 'USA',
			state: 'AZ',
			min: 10,
			sort: 'opr',
			q: '',
			team: 0,
			page: 3,
			type: '',
			dates: '',
			from: '',
			to: ''
		});
	});

	it('drops values that are not valid and keeps numbers in range', () => {
		const params = new URLSearchParams('region=<script>&country=%00&min=-5&page=0');
		expect(parseFilters(params)).toEqual(none);
		expect(parseFilters(new URLSearchParams('min=9999&page=abc'))).toMatchObject({
			min: 200,
			page: 1
		});
		expect(parseFilters(new URLSearchParams('region=' + 'A'.repeat(40))).region).toBe('');
		expect(parseFilters(new URLSearchParams('sort=name&team=-4')).sort).toBe('opr');
		expect(parseFilters(new URLSearchParams('team=abc')).team).toBe(0);
		expect(parseFilters(new URLSearchParams('q=' + 'x'.repeat(90))).q).toHaveLength(40);
	});
});

describe('queryString', () => {
	it('leaves out defaults and writes the page last', () => {
		expect(queryString(none)).toBe('');
		expect(queryString({ ...none, region: 'USAZ', min: 10 }, 2)).toBe('?region=USAZ&min=10&page=2');
		expect(queryString({ ...none, country: 'USA', state: 'AZ' })).toBe('?country=USA&state=AZ');
		expect(queryString({ ...none, sort: 'tips', q: 'robo', team: 42 })).toBe(
			'?sort=tips&q=robo&team=42'
		);
	});

	it('round trips through parseFilters', () => {
		const filters: LeaderboardFilters = {
			region: 'USAZ',
			country: 'USA',
			state: 'AZ',
			min: 15,
			sort: 'auto',
			q: 'robo',
			team: 1234,
			page: 4,
			type: 'Qualifier',
			dates: '',
			from: '2026-11-01',
			to: '2026-11-15'
		};
		expect(parseFilters(new URLSearchParams(queryString(filters)))).toEqual(filters);
	});
});

describe('createDataset', () => {
	const dataset = createDataset(rows);

	it('sorts by OPR with the team number as the tiebreak', () => {
		expect(dataset.rows.map((entry) => entry.team)).toEqual([2, 5, 3, 4, 7, 1, 6]);
	});

	it('lists regions, countries and the states of each country', () => {
		expect(dataset.regions).toEqual([
			{ value: 'USAZ', label: 'Arizona' },
			{ value: 'USCALA', label: 'California Los Angeles' },
			{ value: 'CN', label: 'China' },
			{ value: 'CAON', label: 'Ontario' }
		]);
		expect(dataset.countries.map((option) => option.value)).toEqual(['Canada', 'China', 'USA']);
		expect(dataset.states.USA).toEqual([
			{ value: 'AZ', label: 'Arizona' },
			{ value: 'CA', label: 'California' }
		]);
		expect(dataset.states.Canada).toEqual([{ value: 'ON', label: 'Ontario' }]);
		expect(dataset.states.China).toEqual([{ value: 'SH', label: 'SH' }]);
	});
});

describe('filterRows', () => {
	const sorted = createDataset(rows).rows;
	const teams = (filters: Partial<LeaderboardFilters>) =>
		filterRows(sorted, { ...none, ...filters }).map((entry) => entry.team);

	it('always leaves out teams with no matches', () => {
		expect(teams({})).toEqual([2, 5, 3, 4, 1, 6]);
	});

	it('filters by minimum matches', () => {
		expect(teams({ min: 5 })).toEqual([2, 5, 3, 1, 6]);
		expect(teams({ min: 11 })).toEqual([]);
	});

	it('filters by region, country and state, keeping the ranking order', () => {
		expect(teams({ region: 'USAZ' })).toEqual([2, 4, 1]);
		expect(teams({ country: 'USA' })).toEqual([2, 3, 4, 1]);
		expect(teams({ country: 'USA', state: 'CA' })).toEqual([3]);
		expect(teams({ country: 'USA', region: 'USAZ', min: 5 })).toEqual([2, 1]);
	});

	it('finds teams by number prefix, name or city', () => {
		expect(teams({ q: '5' })).toEqual([5]);
		expect(teams({ q: 'team 3' })).toEqual([3]);
		expect(teams({ q: 'los ang' })).toEqual([3]);
		expect(teams({ q: 'TORONTO' })).toEqual([5]);
		expect(teams({ q: 'eam' })).toEqual([]);
		expect(teams({ q: '  ' })).toEqual([2, 5, 3, 4, 1, 6]);
	});

	it('sorts by another column with OPR as the tiebreak', () => {
		expect(teams({ sort: 'matches' })).toEqual([2, 5, 3, 1, 6, 4]);
		expect(teams({ sort: 'auto' })).toEqual([2, 5, 3, 4, 1, 6]);
	});
});

describe('matchesQuery', () => {
	it('ignores accents and punctuation', () => {
		expect(matchesQuery(row(9, 1, { name: 'Robótica São-Paulo' }), 'robotica sao')).toBe(true);
		expect(matchesQuery(row(9, 1, { name: 'Robótica São-Paulo' }), 'paulo')).toBe(true);
		expect(matchesQuery(row(9, 1, { name: null, city: null, state: null }), 'x')).toBe(false);
	});
});

describe('teamPage', () => {
	const many = Array.from({ length: 120 }, (_, index) => row(index + 1, 200 - index));

	it('finds the page a team is on', () => {
		expect(teamPage(many, 1)).toBe(1);
		expect(teamPage(many, 51)).toBe(2);
		expect(teamPage(many, 120)).toBe(3);
		expect(teamPage(many, 999)).toBeNull();
	});
});

describe('normalizeText', () => {
	it('keeps letters from other scripts', () => {
		expect(normalizeText('  闵行 Robotics! ')).toBe('闵行 robotics');
	});
});

describe('paginate', () => {
	const many = Array.from({ length: 120 }, (_, index) => row(index + 1, 200 - index));

	it('slices a page and says where it starts', () => {
		const page = paginate(many, 2);
		expect(page).toMatchObject({ total: 120, page: 2, pages: 3, start: PAGE_SIZE });
		expect(page.rows).toHaveLength(PAGE_SIZE);
		expect(page.rows[0].team).toBe(51);
		expect(paginate(many, 3).rows).toHaveLength(20);
	});

	it('keeps the page inside the range', () => {
		expect(paginate(many, 99)).toMatchObject({ page: 3, start: 100 });
		expect(paginate(many, 0)).toMatchObject({ page: 1, start: 0 });
		expect(paginate([], 4)).toMatchObject({ page: 1, pages: 1, total: 0, rows: [] });
	});
});

describe('buildRatingRows', () => {
	const rating = (team: number, opr: number, matches = 8): SeasonRating => ({
		team,
		opr,
		parts: { auto: 10, hive: 20, flower: 3, garden: 2, park: 5, tips: 1.5 },
		matches,
		events: 2,
		rank: 1,
		percentile: 0.9,
		region: 'USAZ'
	});
	const ratings: SeasonRatings = {
		generatedAt: 1,
		teams: [rating(26670, 58.2), rating(3747, 40), rating(99999, 12, 0)]
	};

	it('adds names and places from the team directory', () => {
		const built = buildRatingRows(ratings, [
			{ number: 26670, name: 'SCA Iron Eagles', city: 'Phoenix', state: 'AZ', country: 'USA' }
		]);
		expect(built).toHaveLength(2);
		expect(built[0]).toMatchObject({
			team: 26670,
			name: 'SCA Iron Eagles',
			city: 'Phoenix',
			state: 'AZ',
			country: 'USA',
			region: 'USAZ',
			opr: 58.2,
			auto: 10,
			tips: 1.5,
			matches: 8,
			events: 2
		});
		expect(built[0].teleop).toBeCloseTo(48.2, 5);
	});

	it('keeps teams that are missing from the directory', () => {
		const built = buildRatingRows(ratings, []);
		expect(built[1]).toMatchObject({ team: 3747, name: null, city: null, country: null });
	});
});

describe('speed', () => {
	it('filters and pages a full season of teams quickly', () => {
		const regions = ['USAZ', 'USCALA', 'USTXHO', 'CN', 'CAON'];
		const season = Array.from({ length: 6500 }, (_, index) =>
			row(index + 1, (index * 7919) % 1000, {
				region: regions[index % regions.length],
				matches: 1 + (index % 30)
			})
		);
		const started = performance.now();
		const dataset = createDataset(season);
		for (let run = 0; run < 25; run++) {
			const found = filterRows(dataset.rows, { ...none, region: 'USAZ', min: 10 });
			paginate(found, 1 + (run % 5));
		}
		expect(performance.now() - started).toBeLessThan(500);
	});
});

describe('event filters in the query string', () => {
	it('reads the event type and date range', () => {
		expect(
			parseFilters(new URLSearchParams('type=LeagueMeet&from=2026-11-01&to=2026-11-15'))
		).toMatchObject({ type: 'LeagueMeet', dates: '', from: '2026-11-01', to: '2026-11-15' });
		expect(parseFilters(new URLSearchParams('type=official')).type).toBe('official');
	});

	it('drops unknown types and impossible dates and swaps a backwards range', () => {
		expect(parseFilters(new URLSearchParams('type=Bogus')).type).toBe('');
		expect(parseFilters(new URLSearchParams('type=toString')).type).toBe('');
		expect(parseFilters(new URLSearchParams('from=2026-02-30&to=nope'))).toMatchObject({
			from: '',
			to: ''
		});
		expect(parseFilters(new URLSearchParams('from=2026-11-20&to=2026-11-01'))).toMatchObject({
			from: '2026-11-01',
			to: '2026-11-20'
		});
	});

	it('lets the last two weeks win over a written range', () => {
		expect(
			parseFilters(new URLSearchParams('dates=recent&from=2026-11-01&to=2026-11-02'))
		).toMatchObject({ dates: 'recent', from: '', to: '' });
		expect(parseFilters(new URLSearchParams('dates=forever')).dates).toBe('');
	});

	it('writes event filters into links', () => {
		expect(queryString({ ...none, type: 'Qualifier', dates: 'recent' })).toBe(
			'?type=Qualifier&dates=recent'
		);
		expect(queryString({ ...none, from: '2026-11-01' }, 2)).toBe('?from=2026-11-01&page=2');
	});
});

describe('dateWindow', () => {
	it('turns the filters into an inclusive range of event start dates', () => {
		expect(dateWindow(none, '2026-11-22')).toBeNull();
		expect(dateWindow({ ...none, dates: 'recent' }, '2026-11-22')).toEqual({
			from: '2026-11-09',
			to: '2026-11-22'
		});
		expect(dateWindow({ ...none, from: '2026-11-01' }, '2026-11-22')).toEqual({
			from: '2026-11-01',
			to: '9999-12-31'
		});
		expect(isScoped(leaderboardScope(none, '2026-11-22'))).toBe(false);
		expect(isScoped(leaderboardScope({ ...none, type: 'Qualifier' }, '2026-11-22'))).toBe(true);
	});

	it('labels the range for the summary line', () => {
		expect(windowLabel(null)).toBe('');
		expect(windowLabel({ from: '2026-11-09', to: '2026-11-22' }, true)).toBe('last 2 weeks');
		expect(windowLabel({ from: '2026-11-16', to: '2026-11-22' })).toBe('Nov 16–22');
		expect(windowLabel({ from: '2026-11-01', to: '9999-12-31' })).toBe('since Nov 1');
		expect(windowLabel({ from: '0000-01-01', to: '2026-11-15' })).toBe('through Nov 15');
	});
});

describe('event types', () => {
	it('matches one type or every official type', () => {
		expect(matchesType('Qualifier', '')).toBe(true);
		expect(matchesType('Qualifier', 'Qualifier')).toBe(true);
		expect(matchesType('LeagueMeet', 'Qualifier')).toBe(false);
		expect(matchesType('LeagueMeet', 'official')).toBe(true);
		expect(matchesType('Scrimmage', 'official')).toBe(false);
		expect(typeLabel('LeagueMeet')).toBe('League meet events');
		expect(typeLabel('official')).toBe('Official events');
	});

	it('offers the types and weeks of events that have started', () => {
		const options = eventFilterOptions(
			[
				{ type: 'Qualifier', start: '2026-11-21', hasMatches: true },
				{ type: 'Scrimmage', start: '2026-10-03', hasMatches: true },
				{ type: 'LeagueMeet', start: '2026-11-18', hasMatches: null },
				{ type: 'Championship', start: '2027-02-20', hasMatches: null },
				{ type: 'Workshop', start: '2026-09-12', hasMatches: null },
				{ type: 'OffSeason', start: '2026-09-12', hasMatches: false }
			],
			'2026-11-22'
		);
		expect(options.types.map((option) => option.value)).toEqual([
			'official',
			'Scrimmage',
			'LeagueMeet',
			'Qualifier'
		]);
		expect(options.weeks).toEqual([
			{ value: '2026-11-16', label: 'Nov 16–22' },
			{ value: '2026-09-28', label: 'Sep 28–Oct 4' }
		]);
	});

	it('keeps the type from the address in the options when no event of it has started', () => {
		const types = [{ value: 'Qualifier', label: 'Qualifier' }];
		expect(withSelectedType(types, '')).toBe(types);
		expect(withSelectedType(types, 'Qualifier')).toBe(types);
		expect(withSelectedType(types, 'Championship')).toEqual([
			...types,
			{ value: 'Championship', label: 'Championship' }
		]);
		expect(withSelectedType([], 'official')).toEqual([
			{ value: 'official', label: 'Official events' }
		]);
	});

	it('picks the dates option that matches the filters', () => {
		const weeks = [{ value: '2026-11-16', label: 'Nov 16–22' }];
		expect(datesChoice(none, weeks)).toBe('');
		expect(datesChoice({ ...none, dates: 'recent' }, weeks)).toBe('recent');
		expect(datesChoice({ ...none, from: '2026-11-16', to: '2026-11-22' }, weeks)).toBe(
			'2026-11-16'
		);
		expect(datesChoice({ ...none, from: '2026-11-16', to: '2026-11-20' }, weeks)).toBe('custom');
		expect(datesChoice({ ...none, from: '2026-11-09', to: '2026-11-15' }, weeks)).toBe('custom');
	});
});

describe('scopeRows', () => {
	const table: SeasonEventRatings = {
		generatedAt: 1,
		events: [
			{ code: 'SCRIM', type: 'Scrimmage', start: '2026-10-03', teams: [1, 40, 10, 2, 5] },
			{
				code: 'MEET1',
				type: 'LeagueMeet',
				start: '2026-11-07',
				teams: [1, 50, 12, 3, 6, 2, 70, 20, 4, 6]
			},
			{
				code: 'QUAL',
				type: 'Qualifier',
				start: '2026-11-14',
				teams: [1, 80, 22, 5, 8, 3, 60, 15, 2, 8]
			}
		]
	};
	const base = [row(1, 80), row(2, 70), row(3, 60), row(4, 50)];

	it('uses everything for the whole season', () => {
		const scoped = scopeRows(base, table, { type: '', window: null });
		expect(scoped.map((entry) => [entry.team, entry.opr, entry.matches, entry.events])).toEqual([
			[1, 80, 19, 3],
			[2, 70, 6, 1],
			[3, 60, 8, 1]
		]);
	});

	it('rates each team as of its last event in the filter and counts only those events', () => {
		const scoped = scopeRows(base, table, {
			type: '',
			window: { from: '2026-10-01', to: '2026-11-10' }
		});
		expect(scoped.map((entry) => entry.team)).toEqual([2, 1]);
		expect(scoped[1]).toMatchObject({
			team: 1,
			opr: 50,
			auto: 12,
			teleop: 38,
			tips: 3,
			matches: 11,
			events: 2,
			name: 'Team 1',
			region: 'USAZ'
		});
	});

	it('filters by event type', () => {
		const official = scopeRows(base, table, { type: 'official', window: null });
		expect(official.find((entry) => entry.team === 1)).toMatchObject({ matches: 14, events: 2 });
		const scrims = scopeRows(base, table, { type: 'Scrimmage', window: null });
		expect(scrims.map((entry) => entry.team)).toEqual([1]);
		expect(scopeRows(base, table, { type: 'Championship', window: null })).toEqual([]);
	});
});

describe('filterSummary', () => {
	const options = {
		regions: [{ value: 'USMI', label: 'Michigan' }],
		countries: [{ value: 'USA', label: 'USA' }],
		states: [{ value: 'MI', label: 'Michigan' }],
		types: [{ value: 'official', label: 'Official events' }]
	};

	it('says nothing when no filter is set', () => {
		expect(filterSummary(none, options)).toEqual([]);
	});

	it('names each active filter with its label', () => {
		expect(
			filterSummary(
				{ ...none, region: 'USMI', type: 'official', dates: 'recent', min: 10, sort: 'tips' },
				options
			)
		).toEqual(['Michigan', 'Official events', 'Last 2 weeks', '10+ matches', 'By tips']);
	});

	it('prefers the state over the country and spells out custom dates', () => {
		expect(
			filterSummary({ ...none, country: 'USA', state: 'MI', from: '2026-11-01' }, options)
		).toEqual(['Michigan', 'Since Nov 1']);
		expect(filterSummary({ ...none, country: 'USA' }, options)).toEqual(['USA']);
	});
});
