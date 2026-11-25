import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import LeaderboardTable from './LeaderboardTable.svelte';
import { parseFilters, type LeaderboardRow } from './leaderboard.ts';

afterEach(() => {
	cleanup();
});

function row(team: number, opr: number): LeaderboardRow {
	return {
		team,
		name: `Team ${team}`,
		city: null,
		state: null,
		country: null,
		region: null,
		opr,
		auto: 10,
		teleop: 20,
		tips: 5,
		matches: 12,
		events: 2
	};
}

describe('LeaderboardTable', () => {
	it('links headers to server sorts and marks the picked team', () => {
		const filters = { ...parseFilters(new URLSearchParams('sort=auto')), team: 724 };
		render(LeaderboardTable, { props: { rows: [row(3747, 90), row(724, 80)], start: 0, filters } });
		expect(screen.getByRole('columnheader', { name: 'Auto' })).toHaveAttribute(
			'aria-sort',
			'descending'
		);
		expect(screen.getByRole('link', { name: 'Teleop' }).getAttribute('href')).toContain(
			'sort=teleop'
		);
		const target = screen.getByRole('link', { name: /724/ }).closest('tr');
		expect(target).toHaveAttribute('aria-current', 'true');
		expect(target).toHaveClass('target');
	});
});
