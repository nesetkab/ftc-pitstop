import { describe, expect, it } from 'vitest';
import type { SeasonRating, SeasonRatings } from '#lib/analysis/types.ts';
import {
	PAGE_SIZE,
	buildRatingRows,
	createDataset,
	filterRows,
	paginate,
	parseFilters,
	matchesQuery,
	normalizeText,
	queryString,
	teamPage,
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
	page: 1
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
			page: 3
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
			page: 4
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
