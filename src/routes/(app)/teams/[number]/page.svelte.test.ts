import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MISSING } from '#lib/format/index.ts';
import { follows } from '#lib/components/follow/follow.svelte.ts';
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
		expect(document.title).toBe('FTC 26670 SCA Iron Eagles (Phoenix, Arizona) - PitStop');
	});

	it('describes the team for search and links its canonical page', () => {
		show();
		const description = document.head.querySelector('meta[name="description"]');
		expect(description?.getAttribute('content')).toBe(
			'FTC team 26670 SCA Iron Eagles from Phoenix, Arizona. 2026-27 BIOBUZZ aOPR 58.2, 214th of 3,272 teams worldwide. Qualification record 5-0-0 across 1 event. Match history, aOPR by part and awards.'
		);
		const canonical = document.head.querySelector('link[rel="canonical"]');
		expect(canonical?.getAttribute('href')).toMatch(/\/teams\/26670$/);
		const data = [...document.head.querySelectorAll('script[type="application/ld+json"]')].map(
			(node) => JSON.parse(node.textContent ?? '')
		);
		expect(data.map((item) => item['@type'])).toEqual(['SportsTeam', 'BreadcrumbList']);
		expect(data[0]).toMatchObject({ name: '26670 SCA Iron Eagles', foundingDate: '2024' });
	});

	it('links the region rank to that spot on the leaderboard and draws the event trend', () => {
		show(
			view({
				source: 'ratings',
				stats: {
					opr: 70,
					rank: 12,
					of: 900,
					record: { wins: 9, losses: 1, ties: 0 },
					events: 2,
					region: { code: 'USAZ', rank: 3, of: 40 }
				},
				trend: [
					{ label: 'First', value: 50 },
					{ label: 'Second', value: 70 }
				]
			})
		);
		const stat = (name: string) =>
			screen.getByText((_, node) => node?.tagName === 'DT' && node.textContent === name)
				.nextElementSibling;
		expect(stat('Rank in Arizona')).toHaveTextContent('3 of 40');
		expect(screen.getByRole('link', { name: 'Arizona' })).toHaveAttribute('href', '/regions/USAZ');
		expect(within(stat('Rank in Arizona') as HTMLElement).getByRole('link')).toHaveAttribute(
			'href',
			'/leaderboards?region=USAZ&team=26670'
		);
		expect(within(stat('World rank by aOPR') as HTMLElement).getByRole('link')).toHaveAttribute(
			'href',
			'/leaderboards?team=26670'
		);
		expect(stat('aOPR by event')).toHaveTextContent('+20.0 since first event');
		expect(
			screen.getByRole('img', { name: 'aOPR at each event: First 50.0, Second 70.0' })
		).toBeInTheDocument();
	});

	it('breaks down aOPR by scoring part at each event under the season percentiles', () => {
		show();
		const table = screen.getByRole('table', { name: 'aOPR by scoring part at each event' });
		const rows = within(table).getAllByRole('row');
		expect(rows).toHaveLength(3);
		expect(rows[1]).toHaveTextContent('Season percentile');
		expect(
			within(rows[2]).getByRole('link', { name: 'Roadrunner - Gilbert Qualifier' })
		).toHaveAttribute('href', '/events/USAZGIQ');
	});

	it('shows the stats row', () => {
		show();
		const stat = (name: string) =>
			screen.getByText((_, node) => node?.tagName === 'DT' && node.textContent === name)
				.nextElementSibling;
		expect(stat('Season aOPR')).toHaveTextContent('58.2');
		expect(stat('World rank by aOPR')).toHaveTextContent('214 of 3,272');
		expect(stat('Qual record')).toHaveTextContent('5-0-0 in 1 event');
	});

	it('leads with Follow and keeps the pit screens in one menu', () => {
		show();
		const follow = screen.getByRole('button', { name: 'Follow' });
		expect(follow).toHaveClass('primary');
		expect(screen.getByRole('link', { name: 'Compare' })).toHaveClass('secondary');
		const pit = screen.getByText('Pit', { selector: 'summary' }).closest('details') as HTMLElement;
		expect(within(pit).getByRole('link', { name: /^TV display/ })).toHaveAttribute(
			'href',
			'/26670/tv'
		);
		expect(within(pit).getByRole('link', { name: /^Phone view/ })).toHaveAttribute(
			'href',
			'/26670'
		);
		expect(screen.getByText('Calendar').closest('details')).toBeInTheDocument();
	});

	it('compares the team with all teams using percentiles', () => {
		show();
		const table = screen.getByRole('table', { name: 'aOPR by scoring part at each event' });
		const row = within(table).getByRole('row', { name: /Season percentile/ });
		const cells = [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim());
		expect(cells.slice(0, 3)).toEqual(['93rd', '81st', '94th']);
		expect(cells.slice(3)).toEqual([MISSING, MISSING, MISSING, MISSING, MISSING]);
	});

	it('draws the aOPR chart for each event', () => {
		show();
		expect(screen.getByRole('heading', { name: 'aOPR at each event' })).toBeInTheDocument();
		const chart = screen.getByRole('table', { name: 'aOPR at each event for team 26670' });
		expect(within(chart).getByText('58.2')).toBeInTheDocument();
	});

	it('lists played events with rank, record and playoffs in words', () => {
		show();
		const section = screen.getByRole('region', { name: 'Events' });
		expect(
			within(section).getByRole('link', { name: 'Highest scores with 26670' })
		).toHaveAttribute('href', '/records?team=26670');
		const rows = within(section).getAllByRole('row').slice(1);
		const first = [...rows[0].querySelectorAll('td')].map((cell) => cell.textContent);
		expect(first).toEqual([
			'Roadrunner - Gilbert Qualifier',
			'Nov 14',
			'1',
			'5-0-0',
			'58.2',
			'Captain of alliance 1, lost the final 81–178',
			'Report'
		]);
		expect(
			within(rows[0]).getByRole('link', { name: 'Roadrunner - Gilbert Qualifier' })
		).toHaveAttribute('href', '/events/USAZGIQ');
		expect(within(rows[0]).getByRole('link', { name: 'Report' })).toHaveAttribute(
			'href',
			'/events/USAZGIQ/teams/26670'
		);
		expect(rows).toHaveLength(1);
	});

	it('lists awards once, in their own section, and last season', () => {
		show();
		const awards = screen.getByRole('heading', { name: 'Awards' })
			.nextElementSibling as HTMLElement;
		expect(within(awards).getByText('Finalist alliance')).toBeInTheDocument();
		expect(screen.getAllByText(/Finalist alliance/)).toHaveLength(1);
		const last = screen.getByRole('heading', { name: 'Last season, DECODE' })
			.nextElementSibling as HTMLElement;
		expect(within(last).getByText('1,689 of 8,368')).toBeInTheDocument();
		expect(within(last).getByText('Endgame')).toBeInTheDocument();
	});

	it('lists each match with partners, opponents and the score', () => {
		show();
		const table = screen.getByRole('table', {
			name: 'Matches for 26670 at Roadrunner - Gilbert Qualifier'
		});
		expect(within(table).getByRole('link', { name: 'M10' })).toHaveAttribute(
			'href',
			'/events/USAZGIQ/matches/p10'
		);
		expect(within(table).getByRole('link', { name: '18420' })).toHaveAttribute(
			'href',
			'/teams/18420'
		);
		expect(within(table).getByText('L')).toBeInTheDocument();
		expect(table).toHaveTextContent('81–178');
	});

	it('leaves out the matches section when no event has match data', () => {
		show(view({ matches: [] }));
		expect(screen.queryByRole('heading', { name: 'Matches' })).not.toBeInTheDocument();
	});

	it('shows banners newest first and links current events', () => {
		show(
			view({
				banners: [
					{ season: '2026-27', award: 'Winner', event: 'Arizona Championship', code: 'USAZCMP' },
					{ season: '2025-26', award: 'Inspire', event: 'Utah Championship', code: null }
				]
			})
		);
		const banners = within(screen.getByRole('list', { name: 'Banners' })).getAllByRole('listitem');
		expect(banners).toHaveLength(2);
		expect(banners[0]).toHaveTextContent(/Winner\s*2026-27 Arizona Championship/);
		expect(within(banners[0]).getByRole('link')).toHaveAttribute('href', '/events/USAZCMP');
		expect(banners[1]).toHaveTextContent('Inspire');
		expect(within(banners[1]).queryByRole('link')).toBeNull();
	});

	it('leaves out banners when a team has none', () => {
		show(view({ banners: [] }));
		expect(screen.queryByRole('list', { name: 'Banners' })).not.toBeInTheDocument();
	});

	it('leaves out the awards and last season sections when there is nothing to show', () => {
		show(view({ awards: [], previous: null }));
		expect(screen.queryByRole('heading', { name: 'Awards' })).not.toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: /Last season/ })).not.toBeInTheDocument();
	});

	it('says once that a team has no events yet', () => {
		show(
			view({
				charts: [],
				comparison: [],
				breakdown: [],
				events: [],
				upcoming: [],
				takeaways: [],
				stats: { opr: null, rank: null, of: null, record: null, events: 0, region: null }
			})
		);
		expect(screen.getByText('This team has no events this season.')).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: /aOPR/ })).not.toBeInTheDocument();
		expect(
			screen.queryByText((_, node) => node?.tagName === 'DT' && node.textContent === 'Season aOPR')
		).not.toBeInTheDocument();
		expect(screen.queryByRole('link', { name: /Highest scores/ })).not.toBeInTheDocument();
	});

	it('opens with season takeaways', () => {
		show();
		const lede = screen.getByLabelText('Season takeaways');
		expect(lede.querySelector('mark')?.textContent).toBe(
			'Strongest at teleop, better than 94% of teams.'
		);
		expect(lede.textContent).not.toMatch(/Award|Finalist|worldwide|OPR rose|OPR fell/);
		expect(lede.textContent?.match(/\./g)?.length ?? 0).toBeLessThanOrEqual(5);
	});

	it('lists upcoming events with an outlook and a report link', () => {
		show();
		const table = screen.getByRole('heading', { name: 'Coming up' })
			.nextElementSibling as HTMLElement;
		const row = within(table).getAllByRole('row')[1];
		expect(row).toHaveTextContent('Phoenix Qualifier');
		expect(row).toHaveTextContent('Team list not out yet');
		expect(within(row).getByRole('link', { name: 'Report' })).toHaveAttribute(
			'href',
			'/events/USAZNEXT/teams/26670'
		);
	});

	it('points to the pit display when the team has an event this week', async () => {
		const day = (offset: number) =>
			new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
		const upcoming = (start: string, live: boolean) => ({
			code: 'USAZNEXT',
			name: 'Phoenix Qualifier',
			start,
			end: start,
			live,
			registered: null,
			kind: 'none' as const,
			outlook: ''
		});
		show(view({ upcoming: [upcoming(day(0), true)] }));
		expect(await screen.findByText(/At Phoenix Qualifier today\?/)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'pit display' })).toHaveAttribute('href', '/26670/tv');
		expect(screen.getByRole('link', { name: 'phone view' })).toHaveAttribute('href', '/26670');
		cleanup();
		show(view({ upcoming: [upcoming(day(30), false)] }));
		await screen.findByRole('heading', { name: 'Coming up' });
		expect(screen.queryByRole('link', { name: 'pit display' })).not.toBeInTheDocument();
	});

	it('lists partners and opponents from played matches', () => {
		const played = { ...finalMatch(), result: null } as Match;
		const score = (total: number) => ({
			total,
			preFoulTotal: total,
			auto: 0,
			teleop: total,
			foulPoints: 0,
			breakdown: null
		});
		played.result = { red: score(80), blue: score(120), winner: 'blue' };
		show(
			view({
				allies: buildTeamPage({
					season: season(),
					ratings: null,
					analyses: {},
					bundles: { USAZGIQ: { alliances, matches: [played], phase: 'done' } },
					now: NOW
				}).allies
			})
		);
		const partners = screen.getByRole('heading', { name: 'Partners' })
			.nextElementSibling as HTMLElement;
		const row = within(partners).getAllByRole('row')[1];
		expect(row).toHaveTextContent('18421');
		expect(row).toHaveTextContent('1-0-0');
		expect(within(row).getByRole('link', { name: '120' })).toHaveAttribute(
			'href',
			'/events/USAZGIQ/matches/p10'
		);
		expect(screen.getByRole('heading', { name: 'Toughest opponents' })).toBeInTheDocument();
	});

	it('says when the data is saved and may be old', () => {
		show(view({ stale: true, updated: Date.now() - 20 * 60_000 }));
		expect(screen.getByText(/These stats couldn't be refreshed/)).toBeInTheDocument();
	});
});
