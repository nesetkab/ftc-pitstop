import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOLLOW_KEY, follows } from '#lib/components/team/follow.svelte.ts';
import type {
	FilterOption,
	LeaderboardFilters,
	LeaderboardRow
} from '#lib/components/team/leaderboard.ts';
import Page from './+page.svelte';

const navigation = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => navigation);

beforeEach(() => {
	localStorage.clear();
	follows.teams = [];
	navigation.goto.mockReset();
});

afterEach(() => {
	cleanup();
});

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
		tips: 2.5,
		matches: 12,
		events: 2,
		...overrides
	};
}

interface Data {
	source: 'ratings' | 'scout';
	updated: number;
	filters: LeaderboardFilters;
	found: boolean;
	rows: LeaderboardRow[];
	total: number;
	page: number;
	pages: number;
	start: number;
	population: number;
	regions: FilterOption[];
	countries: FilterOption[];
	states: FilterOption[];
}

const base: Data = {
	source: 'ratings',
	updated: Date.now() - 60_000,
	filters: { region: '', country: '', state: '', min: 0, sort: 'opr', q: '', team: 0, page: 1 },
	found: false,
	rows: [row(26670, 58.24, { name: 'SCA Iron Eagles' }), row(3747, 40, { name: 'The Hive' })],
	total: 120,
	page: 1,
	pages: 3,
	start: 0,
	population: 120,
	regions: [
		{ value: 'USAZ', label: 'USAZ' },
		{ value: 'USCALA', label: 'USCALA' }
	],
	countries: [
		{ value: 'Canada', label: 'Canada' },
		{ value: 'USA', label: 'USA' }
	],
	states: []
};

function show(overrides: Partial<Data> = {}) {
	return render(Page, { props: { data: { ...base, ...overrides } } as never });
}

function bodyRows() {
	return within(screen.getByRole('table')).getAllByRole('row').slice(1);
}

describe('leaderboard page', () => {
	it('lists the columns for rank, team, location and the OPR parts', () => {
		show();
		const headers = within(screen.getByRole('table'))
			.getAllByRole('columnheader')
			.map((cell) => cell.textContent?.replace('↓', '').trim());
		expect(headers).toEqual([
			'Rank',
			'Team',
			'Location',
			'OPR',
			'Auto',
			'Teleop',
			'Tips',
			'Matches',
			'Events'
		]);
	});

	it('shows each team with its numbers and a link to its page', () => {
		show();
		const [first, second] = bodyRows();
		expect([...first.querySelectorAll('td')].map((cell) => cell.textContent)).toEqual([
			'1',
			'26670 SCA Iron Eagles',
			'Phoenix, AZ',
			'58.2',
			'14.6',
			'43.7',
			'2.5',
			'12',
			'2'
		]);
		expect(within(first).getByRole('link')).toHaveAttribute('href', '/teams/26670');
		expect(within(second).getByRole('link')).toHaveAttribute('href', '/teams/3747');
	});

	it('continues the rank numbers on later pages', () => {
		show({ start: 50, page: 2 });
		const ranks = bodyRows().map((tr) => tr.querySelector('td')?.textContent);
		expect(ranks).toEqual(['51', '52']);
		expect(screen.getByText('Showing 51 to 52 of 120 teams')).toBeInTheDocument();
	});

	it('links to the previous and next pages and keeps the filters', () => {
		show({
			start: 50,
			page: 2,
			filters: {
				region: 'USAZ',
				country: '',
				state: '',
				min: 10,
				sort: 'opr',
				q: '',
				team: 0,
				page: 2
			}
		});
		expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
			'href',
			'/leaderboards?region=USAZ&min=10'
		);
		expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
			'href',
			'/leaderboards?region=USAZ&min=10&page=3'
		);
		expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
	});

	it('disables Previous on the first page and Next on the last', () => {
		show();
		expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
		cleanup();
		show({ page: 3, pages: 3, start: 100 });
		expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
	});

	it('hides the pager when everything fits on one page', () => {
		show({ pages: 1, total: 2 });
		expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument();
	});

	it('links each sortable column and marks the active one', () => {
		const filters = { ...base.filters, region: 'USAZ', sort: 'auto' as const, page: 2 };
		show({ filters });
		const auto = screen.getByRole('columnheader', { name: /Auto/ });
		expect(auto).toHaveAttribute('aria-sort', 'descending');
		expect(within(auto).getByRole('link')).toHaveAttribute(
			'href',
			'/leaderboards?region=USAZ&sort=auto'
		);
		expect(
			within(screen.getByRole('columnheader', { name: /OPR/ })).getByRole('link')
		).toHaveAttribute('href', '/leaderboards?region=USAZ');
		expect(screen.getByText(/Sorted by auto OPR/)).toBeInTheDocument();
	});

	it('marks the team that was asked for and keeps it out of the pager and CSV links', () => {
		show({ filters: { ...base.filters, team: 3747 }, found: true });
		const target = bodyRows().find((item) => item.getAttribute('aria-current') === 'true');
		expect(target).toHaveTextContent('3747');
		expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
			'href',
			'/leaderboards?page=2'
		);
		expect(screen.getByRole('link', { name: 'Download CSV' })).toHaveAttribute(
			'href',
			'/leaderboards.csv'
		);
	});

	it('says when the team asked for is not in the list', () => {
		show({ filters: { ...base.filters, team: 9999 } });
		expect(screen.getByText('Team 9999 is not in this list.')).toBeInTheDocument();
	});

	it('highlights followed teams', async () => {
		localStorage.setItem(FOLLOW_KEY, '[3747]');
		show();
		const [first, second] = bodyRows();
		await vi.waitFor(() => expect(second).toHaveClass('me'));
		expect(first).not.toHaveClass('me');
	});

	it('says when no team matches the filters', () => {
		show({ rows: [], total: 0, pages: 1 });
		expect(screen.getByText('No teams match these filters.')).toBeInTheDocument();
		expect(screen.getByText('No teams')).toBeInTheDocument();
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
	});

	it('leaves out the events column when the source has no event counts', () => {
		show({ rows: base.rows.map((entry) => ({ ...entry, events: null })) });
		const headers = within(screen.getByRole('table'))
			.getAllByRole('columnheader')
			.map((cell) => cell.textContent);
		expect(headers).not.toContain('Events');
		expect(bodyRows()[0].querySelectorAll('td')).toHaveLength(8);
	});

	it('explains the partial list when season ratings are missing', () => {
		show({ source: 'scout', population: 480 });
		expect(screen.getByText(/only the top 480 teams are listed/)).toBeInTheDocument();
		expect(screen.getByText(/best event OPR from FTCScout/)).toBeInTheDocument();
	});
});

describe('leaderboard filters', () => {
	it('filters by region by changing the query string', async () => {
		show();
		await fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'USAZ' } });
		expect(navigation.goto).toHaveBeenCalledWith('?region=USAZ', { reset: false });
	});

	it('combines the other filters that are set', async () => {
		show({
			filters: {
				region: 'USAZ',
				country: '',
				state: '',
				min: 0,
				sort: 'opr',
				q: '',
				team: 0,
				page: 1
			}
		});
		await fireEvent.change(screen.getByLabelText('Minimum matches'), { target: { value: '10' } });
		expect(navigation.goto).toHaveBeenCalledWith('?region=USAZ&min=10', { reset: false });
	});

	it('clears the state when the country changes', async () => {
		show({
			filters: {
				region: '',
				country: 'USA',
				state: 'AZ',
				min: 0,
				sort: 'opr',
				q: '',
				team: 0,
				page: 1
			},
			states: [{ value: 'AZ', label: 'Arizona' }]
		});
		await fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Canada' } });
		expect(navigation.goto).toHaveBeenCalledWith('?country=Canada', { reset: false });
	});

	it('only offers states once a country is chosen', () => {
		show();
		expect(screen.getByLabelText('State or province')).toBeDisabled();
		cleanup();
		show({
			filters: {
				region: '',
				country: 'USA',
				state: '',
				min: 0,
				sort: 'opr',
				q: '',
				team: 0,
				page: 1
			},
			states: [{ value: 'AZ', label: 'Arizona' }]
		});
		const state = screen.getByLabelText('State or province');
		expect(state).toBeEnabled();
		expect(within(state).getByRole('option', { name: 'Arizona' })).toBeInTheDocument();
	});

	it('reflects the current filters and offers a way to clear them', () => {
		show({
			filters: {
				region: 'USAZ',
				country: '',
				state: '',
				min: 7,
				sort: 'opr',
				q: '',
				team: 0,
				page: 1
			}
		});
		expect(screen.getByLabelText('Region')).toHaveValue('USAZ');
		expect(screen.getByLabelText('Minimum matches')).toHaveValue('7');
		expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
			'href',
			'/leaderboards'
		);
	});

	it('does not show the clear link when no filter is set', () => {
		show();
		expect(screen.queryByRole('link', { name: 'Clear filters' })).not.toBeInTheDocument();
	});
});
