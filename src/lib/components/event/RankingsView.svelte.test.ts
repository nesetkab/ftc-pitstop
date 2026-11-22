import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import RankingsView from './RankingsView.svelte';
import { rpCounts } from './standings.ts';
import { fakeAnalysis, fixtureBundle, unplay } from './test-fixtures.ts';

afterEach(() => {
	cleanup();
});

const finished = fixtureBundle('USAZGIQ');
const midway = unplay(finished, (match) => match.level === 'playoff' || match.number > 22);

function headers() {
	return screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim());
}

function bodyRows(table: HTMLElement) {
	return within(table).getAllByRole('row').slice(table.querySelectorAll('thead tr').length);
}

describe('RankingsView', () => {
	it('shows the FTC rankings without any analysis', () => {
		render(RankingsView, { props: { bundle: finished } });
		expect(headers()).toEqual(['Rank', 'Team', 'RS', 'Record', 'TBP', 'NP max', 'Avg tips']);
		const table = screen.getByRole('table', { name: 'Rankings' });
		const rows = bodyRows(table);
		expect(rows).toHaveLength(27);
		expect(rows[0]).toHaveTextContent('1');
		expect(rows[0]).toHaveTextContent('26670');
		expect(rows[0]).toHaveTextContent('SCA Iron Eagles');
		expect(rows[0]).toHaveTextContent('4.40');
		expect(rows[0]).toHaveTextContent('5-0-0');
		expect(rows[0].querySelectorAll('td')[5]).toHaveTextContent('110');
		expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/teams/26670');
		expect(screen.queryByText(/Projected after/)).toBeNull();
		expect(screen.queryByText('Schedule so far')).toBeNull();
		expect(screen.queryByText(/OPR is/)).toBeNull();
	});

	it('adds OPR, projections and schedule strength when analysis is present', () => {
		render(RankingsView, { props: { bundle: midway, analysis: fakeAnalysis(midway) } });
		expect(screen.getByText('Projected after 34 matches')).toBeInTheDocument();
		expect(headers()).toEqual(
			expect.arrayContaining(['OPR', 'Finish, 1st to 27th', 'Top 4', 'Top 8'])
		);
		const table = screen.getByRole('table', { name: 'Rankings' });
		const first = bodyRows(table)[0];
		expect(first).toHaveTextContent('60.0');
		expect(within(first).getByRole('img')).toHaveAccessibleName('Most likely finish 1st, 60%');
		expect(first).toHaveTextContent('90%');
		expect(first).toHaveTextContent('95%');
		expect(screen.getByText(/12 remaining qualification matches/)).toBeInTheDocument();
		expect(screen.getByRole('table', { name: 'Schedule so far' })).toBeInTheDocument();
	});

	it('hides the projection once every qualification match is played', () => {
		render(RankingsView, { props: { bundle: finished, analysis: fakeAnalysis(finished) } });
		expect(screen.queryByText(/Projected after/)).toBeNull();
		expect(headers()).toContain('OPR');
		expect(screen.getByRole('columnheader', { name: 'Record' })).not.toHaveClass('opt');
		expect(screen.getByRole('table', { name: 'Schedule strength' })).toBeInTheDocument();
		expect(screen.queryByText('Schedule so far')).toBeNull();
	});

	it('drops low-value columns on phones', () => {
		render(RankingsView, { props: { bundle: midway, analysis: fakeAnalysis(midway) } });
		const table = screen.getByRole('table', { name: 'Rankings' });
		const optional = within(table)
			.getAllByRole('columnheader')
			.filter((cell) => cell.classList.contains('opt'))
			.map((cell) => cell.textContent?.trim());
		expect(optional).toEqual([
			'Record',
			'TBP',
			'NP max',
			'Avg tips',
			'Finish, 1st to 27th',
			'Top 4'
		]);
		const first = bodyRows(table)[0];
		expect(first.querySelectorAll('td.opt')).toHaveLength(6);
		expect(screen.getByText('Projected after 34 matches').closest('tr')).toHaveClass('opt');
	});

	it('links the CSV download when given one', () => {
		render(RankingsView, {
			props: { bundle: finished, csvHref: '/events/USAZGIQ/rankings.csv' }
		});
		expect(screen.getByRole('link', { name: 'Download CSV' })).toHaveAttribute(
			'href',
			'/events/USAZGIQ/rankings.csv'
		);
	});

	it('highlights followed teams', () => {
		render(RankingsView, { props: { bundle: finished, followed: new Set([14624]) } });
		const table = screen.getByRole('table', { name: 'Rankings' });
		const marked = bodyRows(table).filter((row) => row.classList.contains('me'));
		expect(marked).toHaveLength(1);
		expect(marked[0]).toHaveTextContent('14624');
	});

	it('names league teams that did not play at this meet', () => {
		render(RankingsView, { props: { bundle: fixtureBundle('USMIWMM8') } });
		const rows = bodyRows(screen.getByRole('table', { name: 'Rankings' }));
		expect(rows).toHaveLength(33);
		expect(rows[4]).toHaveTextContent('24371');
		expect(rows[4]).toHaveTextContent('Proto Pioneers');
		expect(screen.getByText(/These are league rankings/)).toBeInTheDocument();
	});

	it('leaves out the league note when every ranked team played here', () => {
		render(RankingsView, { props: { bundle: finished } });
		expect(screen.queryByText(/league rankings/)).toBeNull();
	});

	it('says when there are no rankings yet', () => {
		render(RankingsView, { props: { bundle: fixtureBundle('USMTBUQ') } });
		expect(screen.getByText('No rankings yet.')).toBeInTheDocument();
		expect(screen.queryByRole('table')).toBeNull();
	});

	it('shows where each team got its ranking points', () => {
		render(RankingsView, { props: { bundle: finished, rp: rpCounts(finished.matches) } });
		const table = screen.getByRole('table', { name: 'Where ranking points came from' });
		const first = bodyRows(table)[0];
		const cells = Array.from(first.querySelectorAll('td')).map((cell) => cell.textContent?.trim());
		expect(cells[0]).toBe('1');
		expect(cells[3]).toBe('100%');
		expect(cells.slice(4, 7).every((cell) => /^\d+%$/.test(cell ?? ''))).toBe(true);
		expect(screen.getByText(/Swarm takes 16 leave and park points/)).toBeInTheDocument();
	});

	it('leaves the ranking point table out without match detail', () => {
		render(RankingsView, { props: { bundle: finished } });
		expect(screen.queryByRole('table', { name: 'Where ranking points came from' })).toBeNull();
	});
});
