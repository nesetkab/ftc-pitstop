import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import RegionTeams from './RegionTeams.svelte';
import type { RegionTeam } from './regions.ts';

afterEach(() => {
	cleanup();
});

const teams: RegionTeam[] = [
	{
		team: 3747,
		name: 'Alpha',
		place: 'Sandy',
		opr: 90,
		auto: 20,
		teleop: 70,
		matches: 10,
		rank: 4
	},
	{ team: 724, name: 'Beta', place: 'Utah', opr: 80, auto: 30, teleop: 50, matches: 10, rank: 9 }
];

function order() {
	return screen
		.getAllByRole('row')
		.slice(1)
		.map((row) => within(row).getAllByRole('cell')[1].querySelector('b')?.textContent);
}

describe('RegionTeams', () => {
	it('sorts the top teams in the browser and keeps their region place', async () => {
		render(RegionTeams, { props: { teams, caption: 'Top teams' } });
		expect(order()).toEqual(['3747', '724']);
		await fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
		expect(order()).toEqual(['724', '3747']);
		const first = screen.getAllByRole('row')[1];
		expect(within(first).getAllByRole('cell')[0]).toHaveTextContent('2');
	});
});
