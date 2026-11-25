import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { Comparison } from '#lib/components/compare/compare.ts';
import { emptyParts, type FitParts } from '#lib/components/compare/fit.ts';
import Page from './+page.svelte';

const fitParts = (parts: Partial<FitParts>): FitParts => ({ ...emptyParts(), ...parts });

afterEach(() => {
	cleanup();
});

const tally = (wins: number, losses: number, ties = 0) => ({ wins, losses, ties });

const view: Comparison = {
	teams: [
		{ number: 100, name: 'Alpha', place: 'Phoenix, AZ' },
		{ number: 200, name: 'Bravo', place: 'Tempe, AZ' }
	],
	rows: [
		{ key: 'opr', label: 'Season aOPR', values: ['120.0', '60.0'], best: [0], nested: false },
		{ key: 'hive', label: 'Hive', values: ['60.0', '30.0'], best: [0], nested: true }
	],
	pairs: [
		{
			a: 100,
			b: 200,
			together: tally(1, 0),
			against: tally(2, 1, 1),
			best: { score: 140, code: 'BBB', key: 'p1', label: 'M1' }
		}
	],
	meetings: [
		{
			code: 'BBB',
			event: 'Gilbert Qualifier',
			start: '2026-11-14',
			key: 'q2',
			label: 'Q2',
			red: [100, 9],
			blue: [200, 10],
			redScore: 80,
			blueScore: 100,
			winner: 'blue'
		}
	],
	shared: [
		{
			code: 'BBB',
			name: 'Gilbert Qualifier',
			start: '2026-11-14',
			cells: [
				{ attending: true, rank: 3, record: '4-1-0', opr: 70, awards: [] },
				{ attending: true, rank: null, record: null, opr: null, awards: [] }
			]
		}
	],
	fit: {
		teams: [
			{ number: 100, opr: 120, parts: fitParts({ auto: 50, teleop: 70, hive: 60, tips: 3 }) },
			{ number: 200, opr: 60, parts: fitParts({ auto: 10, teleop: 50, hive: 40, tips: 1 }) }
		],
		missing: [],
		average: fitParts({ auto: 8, teleop: 18, hive: 13, tips: 0.7 }),
		alliances: [
			{
				teams: [100, 200],
				score: 180,
				parts: fitParts({ auto: 60, teleop: 120, hive: 100, tips: 4 }),
				chances: { swarm: 0.9, pollinator1: 0.55, pollinator2: 0.004 }
			}
		],
		notes: ['100 brings 83% of the combined auto points.']
	},
	history: true,
	source: 'ratings'
};

function show(overrides: Partial<{ view: Comparison; missing: number[] }> = {}) {
	const data = { view, numbers: [100, 200], missing: [], suggestions: [], ...overrides };
	render(Page, { props: { data, params: {} } as never });
}

describe('compare page', () => {
	it('links to the simulator with the same teams from the tab row', () => {
		show();
		const tabs = screen.getByRole('navigation', { name: 'Team tools' });
		expect(within(tabs).getByRole('link', { name: 'Compare' })).toHaveAttribute(
			'href',
			'/compare?teams=100,200'
		);
		expect(within(tabs).getByRole('link', { name: 'Simulate' })).toHaveAttribute(
			'href',
			'/simulate?red=100,200'
		);
	});

	it('shows the teams side by side and marks the best value', () => {
		show();
		const table = screen.getByRole('table', { name: 'Season stats side by side' });
		expect(within(table).getByRole('link', { name: '100' })).toHaveAttribute('href', '/teams/100');
		const opr = within(table).getByRole('row', { name: /Season aOPR/ });
		expect(within(opr).getByText('120.0')).toHaveClass('best');
		expect(within(opr).getByText('60.0')).not.toHaveClass('best');
		expect(screen.getByRole('link', { name: 'Remove 100' })).toHaveAttribute(
			'href',
			'/compare?teams=200'
		);
	});

	it('explains head to head results and lists the matches', () => {
		show();
		const pairs = screen.getByRole('table', { name: 'Results between each pair of teams' });
		expect(within(pairs).getByText('100 won 2, 200 won 1, 1 tied')).toBeInTheDocument();
		expect(within(pairs).getByText(/1-0-0 in 1 match/)).toBeInTheDocument();
		expect(within(pairs).getByRole('link', { name: 'M1' })).toHaveAttribute(
			'href',
			'/events/BBB/matches/p1'
		);
		const matches = screen.getByRole('table', { name: 'Matches with two or more of these teams' });
		expect(within(matches).getByRole('link', { name: 'Q2' })).toHaveAttribute(
			'href',
			'/events/BBB/matches/q2'
		);
		const shared = screen.getByRole('table', {
			name: 'Events where two or more of these teams were entered'
		});
		expect(within(shared).getByText('3rd, 4-1-0')).toBeInTheDocument();
		expect(within(shared).getByText('Registered')).toBeInTheDocument();
	});

	it('shows how the teams would fit as an alliance', () => {
		show();
		expect(screen.getByText(/would score about/)).toHaveTextContent(
			'Together, 100 + 200 would score about 180 points per match.'
		);
		const chances = screen.getByRole('table', {
			name: 'Predicted score and ranking point chances for each pair'
		});
		const row = within(chances).getByRole('row', { name: /100 \+ 200/ });
		expect(within(row).getByText('90%')).toBeInTheDocument();
		expect(within(row).getByText('55%')).toBeInTheDocument();
		expect(within(row).getByText('<1%')).toBeInTheDocument();
		const parts = screen.getByRole('table', {
			name: 'Points by part for each pair, against an average pair'
		});
		const autoRow = within(parts).getByRole('row', { name: /Auto/ });
		expect(within(autoRow).getByText('100 83%')).toBeInTheDocument();
		expect(within(autoRow).getByText('16.0')).toBeInTheDocument();
		expect(screen.getByText('100 brings 83% of the combined auto points.')).toBeInTheDocument();
	});

	it('says when match history has not loaded yet', () => {
		show({ view: { ...view, fit: null, history: false, meetings: [] } });
		expect(
			screen.getByText('Match history is still loading. Try again in a minute.')
		).toBeInTheDocument();
		expect(
			screen.queryByRole('table', { name: 'Results between each pair of teams' })
		).not.toBeInTheDocument();
		expect(screen.queryByText('Alliance fit')).not.toBeInTheDocument();
	});

	it('asks for teams when none are picked and names unknown numbers', () => {
		show({
			view: {
				teams: [],
				rows: [],
				pairs: [],
				meetings: [],
				shared: [],
				fit: null,
				history: false,
				source: null
			},
			missing: [404]
		});
		expect(screen.getByText('Pick two or more teams to compare.')).toBeInTheDocument();
		expect(screen.getByRole('status')).toHaveTextContent('No team has the number 404.');
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
	});
});
