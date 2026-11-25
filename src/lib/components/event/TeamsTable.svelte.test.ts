import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import TeamsTable from './TeamsTable.svelte';
import { fixtureBundle } from './test-fixtures.ts';

afterEach(() => {
	cleanup();
});

function order() {
	return screen
		.getAllByRole('row')
		.slice(1)
		.map((row) => Number(within(row).getAllByRole('cell')[0].querySelector('b')?.textContent));
}

describe('TeamsTable', () => {
	it('keeps a space between the world rank and the team count', () => {
		const { teams } = fixtureBundle('USAZGIQ');
		const team = teams[0].number;
		render(TeamsTable, {
			props: { teams, season: { [team]: { opr: 40.2, rank: 850 } }, seasonCount: 3274 }
		});
		const row = screen.getByRole('link', { name: new RegExp(String(team)) }).closest('tr')!;
		expect(row.lastElementChild?.textContent?.replace(/\s+/g, ' ').trim()).toBe('850 of 3,274');
	});

	it('keeps the location on phones only when there are no stats', () => {
		const { teams } = fixtureBundle('USAZGIQ');
		render(TeamsTable, { props: { teams } });
		expect(screen.getByRole('columnheader', { name: 'Location' })).not.toHaveClass('hide-phone');
		expect(screen.getByRole('columnheader', { name: 'Rookie year' })).toHaveClass('hide-phone');
		cleanup();
		render(TeamsTable, {
			props: { teams, season: { [teams[0].number]: { opr: 40.2, rank: 850 } } }
		});
		expect(screen.getByRole('columnheader', { name: 'Location' })).toHaveClass('hide-phone');
		expect(screen.getByRole('columnheader', { name: 'Season aOPR' })).not.toHaveClass('hide-phone');
		expect(screen.getByRole('columnheader', { name: 'World rank' })).toHaveClass('hide-phone');
	});

	it('sorts teams by rank, record and aOPR in the browser', async () => {
		const { teams, rankings } = fixtureBundle('USAZGIQ');
		const ratings = teams.map((team, index) => ({ team: team.number, opr: index }));
		render(TeamsTable, { props: { teams, rankings, ratings: ratings as never } });
		const numbers = [...teams].map((team) => team.number).sort((a, b) => a - b);
		expect(order()).toEqual(numbers);
		await fireEvent.click(screen.getByRole('button', { name: 'Rank' }));
		const byRank = [...rankings].sort((a, b) => a.rank - b.rank).map((row) => row.team);
		expect(order().slice(0, byRank.length)).toEqual(byRank);
		await fireEvent.click(screen.getByRole('button', { name: 'aOPR here' }));
		expect(order()).toEqual([...ratings].reverse().map((rating) => rating.team));
		expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument();
	});
});
