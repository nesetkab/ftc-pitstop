import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import EventTable from './EventTable.svelte';
import type { HomeEvent } from './home.ts';

afterEach(() => {
	cleanup();
});

function events(count: number): HomeEvent[] {
	return Array.from({ length: count }, (_, index) => ({
		code: `EV${index}`,
		name: `Event ${index}`,
		type: 'Qualifier',
		place: 'Gilbert, AZ',
		dates: 'Nov 20–21',
		status: 'In 2 days'
	}));
}

describe('event table', () => {
	it('lists each event with a link, place, type and dates', () => {
		render(EventTable, { props: { rows: events(2), caption: 'Events this week' } });
		const table = screen.getByRole('table', { name: 'Events this week' });
		const headers = within(table)
			.getAllByRole('columnheader')
			.map((header) => header.textContent);
		expect(headers).toEqual(['Event', 'Where', 'Type', 'Dates']);
		const row = within(table).getAllByRole('row')[1];
		expect([...row.querySelectorAll('td')].map((cell) => cell.textContent)).toEqual([
			'Event 0 Gilbert, AZ',
			'Gilbert, AZ',
			'Qualifier',
			'Nov 20–21'
		]);
		expect(within(row).getByRole('link')).toHaveAttribute('href', '/events/EV0');
		expect(within(table).getAllByRole('row')).toHaveLength(3);
	});
});
