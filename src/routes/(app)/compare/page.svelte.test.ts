import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { Comparison } from '#lib/components/compare/compare.ts';
import Page from './+page.svelte';

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
		{ key: 'opr', label: 'Season OPR', values: ['120.0', '60.0'], best: [0], nested: false },
		{ key: 'hive', label: 'Hive', values: ['60.0', '30.0'], best: [0], nested: true }
	],
	pairs: [{ a: 100, b: 200, together: tally(0, 0), against: tally(2, 1, 1) }],
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
	source: 'ratings'
};

function show(overrides: Partial<{ view: Comparison; missing: number[] }> = {}) {
	const data = { view, numbers: [100, 200], missing: [], suggestions: [], ...overrides };
	render(Page, { props: { data, params: {} } as never });
}

describe('compare page', () => {
	it('shows the teams side by side and marks the best value', () => {
		show();
		const table = screen.getByRole('table', { name: 'Season stats side by side' });
		expect(within(table).getByRole('link', { name: '100' })).toHaveAttribute('href', '/teams/100');
		const opr = within(table).getByRole('row', { name: /Season OPR/ });
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
		expect(within(pairs).getByText('Never on the same alliance')).toBeInTheDocument();
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

	it('asks for teams when none are picked and names unknown numbers', () => {
		show({
			view: { teams: [], rows: [], pairs: [], meetings: [], shared: [], source: null },
			missing: [404]
		});
		expect(screen.getByText('Pick two or more teams to compare.')).toBeInTheDocument();
		expect(screen.getByRole('status')).toHaveTextContent('No team found for 404.');
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
	});
});
