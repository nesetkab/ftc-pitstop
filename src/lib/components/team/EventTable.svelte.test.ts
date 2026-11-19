import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
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
		dates: 'Today',
		status: 'Matches posted'
	}));
}

function show(rows: HomeEvent[], limit?: number) {
	return render(EventTable, {
		props: {
			rows,
			caption: 'Events running today',
			datesHeader: 'Day',
			statusHeader: 'Status',
			limit
		}
	});
}

describe('event table', () => {
	it('lists each event with a link, place, type, day and status', () => {
		show(events(2));
		const table = screen.getByRole('table', { name: 'Events running today' });
		const headers = within(table)
			.getAllByRole('columnheader')
			.map((header) => header.textContent);
		expect(headers).toEqual(['Event', 'Where', 'Type', 'Day', 'Status']);
		const row = within(table).getAllByRole('row')[1];
		expect([...row.querySelectorAll('td')].map((cell) => cell.textContent)).toEqual([
			'Event 0',
			'Gilbert, AZ',
			'Qualifier',
			'Today',
			'Matches posted'
		]);
		expect(within(row).getByRole('link')).toHaveAttribute('href', '/events/EV0');
	});

	it('shows only the first rows until asked for the rest', async () => {
		show(events(15), 12);
		expect(screen.getAllByRole('row')).toHaveLength(13);
		const toggle = screen.getByRole('button', { name: 'Show all 15' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await fireEvent.click(toggle);
		expect(screen.getAllByRole('row')).toHaveLength(16);
		expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute(
			'aria-expanded',
			'true'
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
		expect(screen.getAllByRole('row')).toHaveLength(13);
	});

	it('has no toggle when everything fits', () => {
		show(events(12), 12);
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});
});
