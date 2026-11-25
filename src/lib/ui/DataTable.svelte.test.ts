import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import DataTable from './DataTable.svelte';
import type { Column } from './data-table.ts';

afterEach(() => {
	cleanup();
});

interface Team {
	number: number;
	opr: number;
}

const rows: Team[] = [
	{ number: 724, opr: 60 },
	{ number: 3747, opr: 90 },
	{ number: 19666, opr: 75 }
];

const columns: Column<Team>[] = [
	{
		key: 'number',
		label: 'Team',
		numeric: true,
		first: 'asc',
		sort: (row) => row.number,
		text: (row) => String(row.number)
	},
	{
		key: 'opr',
		label: 'aOPR',
		numeric: true,
		sort: (row) => row.opr,
		text: (row) => String(row.opr)
	}
];

function order() {
	return screen
		.getAllByRole('row')
		.slice(1)
		.map((row) => within(row).getAllByRole('cell')[0].textContent);
}

describe('DataTable', () => {
	it('sorts in place when a header is pressed and marks the sorted column', async () => {
		render(DataTable<Team>, {
			props: { rows, columns, rowKey: (row: Team) => String(row.number), caption: 'Teams' }
		});
		expect(order()).toEqual(['724', '3747', '19666']);
		await fireEvent.click(screen.getByRole('button', { name: 'aOPR' }));
		expect(order()).toEqual(['3747', '19666', '724']);
		expect(screen.getByRole('columnheader', { name: 'aOPR' })).toHaveAttribute(
			'aria-sort',
			'descending'
		);
		await fireEvent.click(screen.getByRole('button', { name: 'aOPR' }));
		expect(order()).toEqual(['724', '19666', '3747']);
		expect(screen.getByRole('columnheader', { name: 'Team' })).not.toHaveAttribute('aria-sort');
	});

	it('links each header to the next sort when the server sorts', () => {
		render(DataTable<Team>, {
			props: {
				rows,
				columns,
				rowKey: (row: Team) => String(row.number),
				caption: 'Teams',
				sort: { key: 'opr', dir: 'desc' },
				href: (sort: { key: string; dir: string }) => `?sort=${sort.key}&dir=${sort.dir}`
			}
		});
		expect(screen.getByRole('link', { name: 'aOPR' })).toHaveAttribute('href', '?sort=opr&dir=asc');
		expect(screen.getByRole('link', { name: 'Team' })).toHaveAttribute(
			'href',
			'?sort=number&dir=asc'
		);
		expect(order()).toEqual(['724', '3747', '19666']);
	});
});
