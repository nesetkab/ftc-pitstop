import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { Match } from '#lib/types.ts';
import MatchBreakdown from './MatchBreakdown.svelte';
import MatchView from './MatchView.svelte';
import { fakeAnalysis, fixtureBundle, unplay } from './test-fixtures.ts';

afterEach(() => {
	cleanup();
});

const bundle = fixtureBundle('USAZGIQ');
const q26 = bundle.matches.find((match) => match.key === 'q26') as Match;

function row(table: HTMLElement, label: string) {
	const header = within(table)
		.getAllByRole('rowheader')
		.find((cell) => cell.textContent?.trim() === label);
	if (!header) throw new Error(`no row ${label}`);
	return Array.from(header.closest('tr')!.querySelectorAll('td')).map((cell) =>
		cell.textContent?.trim()
	);
}

describe('MatchView after the match', () => {
	it('shows the final score and the full breakdown for each alliance', () => {
		render(MatchView, { props: { bundle, match: q26 } });
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Qualification 26');
		expect(screen.getByText(/^Played at 1:57/)).toBeInTheDocument();
		const score = screen.getByRole('table', { name: 'Final score' });
		expect(score).toHaveTextContent('75');
		expect(score).toHaveTextContent('64');
		const breakdown = screen.getByRole('table', { name: 'Score breakdown' });
		expect(row(breakdown, 'Auto')).toEqual(['', '11', '', '28']);
		expect(row(breakdown, 'Leave')).toEqual(['2', '6', '1', '3']);
		expect(row(breakdown, 'Cell balls')).toEqual(['7', '14', '0', '0']);
		expect(row(breakdown, 'Garden balls')).toEqual(['0', '0', '6', '6']);
		expect(row(breakdown, 'Minor')).toEqual(['0', '', '0', '']);
		expect(row(breakdown, 'Total')).toEqual(['', '75', '', '64']);
		const points = screen.getByRole('table', { name: 'Ranking points' });
		const cells = (label: string) =>
			Array.from(within(points).getByText(label).closest('tr')!.querySelectorAll('td')).map(
				(cell) => cell.textContent?.trim()
			);
		expect(cells('Swarm, leave and park 16+')).toEqual(['Swarm, leave and park 16+', 'Yes', 'Yes']);
		expect(cells('Win')).toEqual(['Win', 'Yes', 'No']);
		expect(screen.queryByRole('table', { name: /prediction/ })).toBeNull();
		expect(screen.getByRole('link', { name: 'Previous match, Q25' })).toHaveAttribute(
			'href',
			'/events/USAZGIQ/matches/q25'
		);
		expect(screen.getByRole('link', { name: 'Next match, Q27' })).toBeInTheDocument();
	});

	it('puts the prediction next to the result when analysis is present', () => {
		render(MatchView, { props: { bundle, match: q26, analysis: fakeAnalysis(bundle) } });
		const score = screen.getByRole('table', { name: 'Final score' });
		expect(
			within(score)
				.getAllByRole('columnheader')
				.map((cell) => cell.textContent)
		).toEqual(['Alliance', 'Teams', 'Score', 'Predicted', 'Win chance']);
		const points = screen.getByRole('table', { name: 'Ranking points' });
		expect(within(points).getAllByText('Chance')).toHaveLength(2);
	});

	it('draws each flower stack from the bottom up', () => {
		const result = structuredClone(q26.result!);
		const flowers = { red: ['red', 'pollen', 'blue'], blue: [], scoring: ['pollen'], audience: [] };
		result.red.breakdown!.teleop.flowers = flowers as never;
		result.blue.breakdown!.teleop.flowers = flowers as never;
		render(MatchBreakdown, { props: { result } });
		expect(
			screen.getByRole('img', {
				name: 'Red alliance flower. Bottom to top: red nectar, pollen, blue nectar.'
			})
		).toBeInTheDocument();
		expect(screen.getByText('Blue on top, red at the bottom')).toBeInTheDocument();
		expect(screen.getByText('Pollen only')).toBeInTheDocument();
		expect(screen.getAllByText('Empty')).toHaveLength(2);
	});
});

describe('MatchView before the match', () => {
	const upcoming = unplay(bundle, (match) => match.level === 'playoff' || match.number >= 26);
	const match = upcoming.matches.find((entry) => entry.key === 'q26') as Match;

	it('shows the prediction, ranking point chances and team ratings', () => {
		render(MatchView, {
			props: {
				bundle: upcoming,
				match,
				analysis: fakeAnalysis(upcoming),
				followed: new Set([14624])
			}
		});
		expect(
			screen.getByText(/Scheduled for 1:58 PM\. Expected around 2:01 PM\. Not played yet\./)
		).toBeInTheDocument();
		const prediction = screen.getByRole('table', { name: 'Q26 prediction' });
		expect(prediction).toHaveTextContent('Win chance');
		expect(prediction).toHaveTextContent('Predicted');
		expect(screen.getByRole('heading', { name: 'Ranking point chances' })).toBeInTheDocument();
		expect(screen.getByText('Expected RP')).toBeInTheDocument();
		const teams = screen.getByRole('table', { name: 'Teams in this match' });
		expect(
			within(teams)
				.getAllByRole('columnheader')
				.map((cell) => cell.textContent)
		).toEqual(['Team', 'Alliance', 'OPR', 'Auto', 'Hive', 'Park', 'Avg tips', 'Matches']);
		expect(screen.getByText(/alliance scores in 25 matches/)).toBeInTheDocument();
	});

	it('hides predictions without analysis', () => {
		render(MatchView, { props: { bundle: upcoming, match } });
		expect(screen.getByText('Scheduled for 1:58 PM. Not played yet.')).toBeInTheDocument();
		expect(screen.queryByText(/Win chance/)).toBeNull();
		expect(screen.queryByRole('heading', { name: /Ranking point/ })).toBeNull();
		const teams = screen.getByRole('table', { name: 'Teams in this match' });
		expect(teams).toHaveTextContent('Rank');
		expect(screen.getByRole('table', { name: 'Alliances' })).toHaveTextContent('25620');
	});
});
