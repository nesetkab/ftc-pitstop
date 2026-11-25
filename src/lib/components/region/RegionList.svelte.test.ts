import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import RegionList from './RegionList.svelte';
import type { RegionSummary } from './regions.ts';

afterEach(() => {
	cleanup();
});

function region(code: string, name: string, teams: number): RegionSummary {
	return {
		code,
		name,
		bucket: 'us',
		teams,
		rated: teams,
		events: 4,
		done: 2,
		live: 0,
		upcoming: 2,
		top: null
	} as RegionSummary;
}

const regions = [region('USAL', 'Alabama', 40), region('USUT', 'Utah', 90)];

function order() {
	return screen
		.getAllByRole('row')
		.slice(1)
		.map((row) => within(row).getAllByRole('link')[0].textContent);
}

describe('RegionList', () => {
	it('sorts regions by a column header', async () => {
		render(RegionList, { props: { regions, caption: 'Regions' } });
		expect(order()).toEqual(['Alabama', 'Utah']);
		await fireEvent.click(screen.getByRole('button', { name: 'Teams' }));
		expect(order()).toEqual(['Utah', 'Alabama']);
		expect(screen.getByText('40 teams')).toBeInTheDocument();
	});
});
