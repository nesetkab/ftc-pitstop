import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import TeamsTable from './TeamsTable.svelte';
import { fixtureBundle } from './test-fixtures.ts';

afterEach(() => {
	cleanup();
});

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
});
