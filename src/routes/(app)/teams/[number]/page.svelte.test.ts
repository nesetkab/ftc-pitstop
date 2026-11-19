import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { follows } from '#lib/components/team/follow.svelte.ts';
import { match, teamEvent, teamSeason } from '#lib/components/team/fixtures.ts';
import { buildTeamPage, type TeamPageData } from '#lib/components/team/team-view.ts';
import type { AllianceSelection, Match, QuickStats, TeamSeason } from '#lib/types.ts';
import Page from './+page.svelte';

const NOW = Date.parse('2026-11-19T12:00:00Z');

beforeAll(() => {
	globalThis.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
});

beforeEach(() => {
	localStorage.clear();
	follows.teams = [];
});

afterEach(() => {
	cleanup();
});

type Pair = [value: number, rank: number];

function quick(
	season: number,
	count: number,
	parts: { total: Pair; auto: Pair; teleop: Pair; endgame: Pair }
): QuickStats {
	const stat = ([value, rank]: Pair) => ({ value, rank });
	return {
		season,
		total: stat(parts.total),
		auto: stat(parts.auto),
		teleop: stat(parts.teleop),
		endgame: stat(parts.endgame),
		count
	};
}

function finalMatch(): Match {
	const score = (total: number) => ({
		total,
		preFoulTotal: total,
		auto: 0,
		teleop: total,
		foulPoints: 0,
		breakdown: null
	});
	return {
		...match(10, [18420, 25620], [26670, 18421], '2026-11-14T22:30:00Z', false),
		key: 'p10',
		level: 'playoff',
		series: 10,
		label: 'M10',
		description: 'Final Bracket Round 6 Match 10',
		result: { red: score(178), blue: score(81), winner: 'red' }
	};
}

const alliances: AllianceSelection[] = [
	{
		seed: 1,
		name: 'Alliance Seed 1',
		captain: 26670,
		picks: [18421],
		backup: null,
		backupReplaced: null
	},
	{
		seed: 2,
		name: 'Alliance Seed 2',
		captain: 18420,
		picks: [25620],
		backup: null,
		backupReplaced: null
	}
];

function season(): TeamSeason {
	const base = teamSeason(26670, 'SCA Iron Eagles', [
		{
			...teamEvent({ code: 'USAZGIQ' }),
			stats: {
				rank: 1,
				rs: 4,
				tbp: 90,
				avgTips: 3,
				wins: 5,
				losses: 0,
				ties: 0,
				dq: 0,
				played: 5,
				opr: { total: 58.2396, auto: 13.2226, teleop: 45.017 }
			},
			awards: [{ id: 12, name: 'Finalist Alliance', placement: 1, team: 26670, person: null }]
		},
		teamEvent({
			code: 'USAZNEXT',
			name: 'Phoenix Qualifier',
			start: '2026-12-05',
			end: '2026-12-06'
		})
	]);
	return {
		...base,
		quickStats: quick(2026, 3272, {
			total: [58.2396, 214],
			auto: [13.2226, 608],
			teleop: [45.017, 177],
			endgame: [-0.6, 3251]
		}),
		previousQuickStats: quick(2025, 8368, {
			total: [63.6, 1689],
			auto: [20.8, 1555],
			teleop: [46, 1806],
			endgame: [12.3, 371]
		})
	};
}

function view(overrides: Partial<TeamPageData> = {}): TeamPageData {
	return {
		...buildTeamPage({
			season: season(),
			ratings: null,
			analyses: {},
			bundles: {
				USAZGIQ: { alliances, matches: [finalMatch()], phase: 'done' }
			},
			now: NOW
		}),
		...overrides
	};
}

function show(data: TeamPageData = view()) {
	return render(Page, { props: { data: { view: data } } as never });
}

describe('team page', () => {
	it('names the team with its place and rookie year', () => {
		show();
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('26670 SCA Iron Eagles');
		expect(screen.getByText('Phoenix, Arizona. Rookie year 2024.')).toBeInTheDocument();
		expect(document.title).toBe('26670 SCA Iron Eagles - PitStop');
	});

	it('shows the stats row', () => {
		show();
		const stat = (name: string) => screen.getByText(name, { selector: 'dt' }).nextElementSibling;
		expect(stat('Season OPR')).toHaveTextContent('58.2');
		expect(stat('World rank by OPR')).toHaveTextContent('214 of 3,272');
		expect(stat('Record')).toHaveTextContent('5-0-0');
		expect(stat('Events')).toHaveTextContent('1');
	});

	it('links to the pit display and the phone view', () => {
		show();
		expect(screen.getByRole('link', { name: 'Pit display' })).toHaveAttribute('href', '/26670/tv');
		expect(screen.getByRole('link', { name: 'Phone view' })).toHaveAttribute('href', '/26670');
		expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
	});

	it('compares the team with all teams using percentiles', () => {
		show();
		const table = screen.getByRole('heading', { name: 'Compared with all teams this season' })
			.nextElementSibling as HTMLElement;
		const rows = within(table)
			.getAllByRole('row')
			.slice(1)
			.map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent));
		expect(rows).toEqual([
			['Total', '58.2', '93rd'],
			['Auto', '13.2', '81st'],
			['Teleop', '45.0', '94th']
		]);
	});

	it('draws the OPR chart for each event', () => {
		show();
		expect(screen.getByRole('heading', { name: 'OPR at each event' })).toBeInTheDocument();
		const chart = screen.getByRole('table', { name: 'OPR at each event for team 26670' });
		expect(within(chart).getByText('58.2')).toBeInTheDocument();
	});

	it('lists events with rank, record, playoffs in words and awards', () => {
		show();
		const table = screen.getByRole('heading', { name: 'Events' }).nextElementSibling as HTMLElement;
		const rows = within(table).getAllByRole('row').slice(1);
		const first = [...rows[0].querySelectorAll('td')].map((cell) => cell.textContent);
		expect(first).toEqual([
			'Roadrunner - Gilbert Qualifier',
			'Nov 14',
			'1',
			'5-0-0',
			'58.2',
			'Captain of alliance 1, lost the final 81–178',
			'Finalist alliance'
		]);
		expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/events/USAZGIQ');
		const second = [...rows[1].querySelectorAll('td')].map((cell) => cell.textContent);
		expect(second).toEqual(['Phoenix Qualifier', 'Dec 5 and 6', '—', '—', '—', 'Upcoming', '—']);
	});

	it('lists awards and last season', () => {
		show();
		const awards = screen.getByRole('heading', { name: 'Awards' })
			.nextElementSibling as HTMLElement;
		expect(within(awards).getByText('Finalist alliance')).toBeInTheDocument();
		const last = screen.getByRole('heading', { name: 'Last season, DECODE' })
			.nextElementSibling as HTMLElement;
		expect(within(last).getByText('1,689 of 8,368')).toBeInTheDocument();
		expect(within(last).getByText('Endgame')).toBeInTheDocument();
	});

	it('leaves out the awards and last season sections when there is nothing to show', () => {
		show(view({ awards: [], previous: null }));
		expect(screen.queryByRole('heading', { name: 'Awards' })).not.toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: /Last season/ })).not.toBeInTheDocument();
	});

	it('tells the user when there are no matches yet', () => {
		show(
			view({
				charts: [],
				comparison: [],
				stats: { opr: null, rank: null, of: null, record: null, events: 0 }
			})
		);
		expect(screen.getAllByText('No matches played yet this season.')).toHaveLength(2);
	});

	it('says when the data is saved and may be old', () => {
		show(view({ stale: true, updated: Date.now() - 20 * 60_000 }));
		expect(screen.getByText(/Showing saved data/)).toBeInTheDocument();
	});
});
