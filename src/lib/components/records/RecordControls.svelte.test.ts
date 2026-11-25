import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecordConditions from './RecordConditions.svelte';
import RecordTable from './RecordTable.svelte';
import { parseRecordFilters, type RankedRecord } from './records.ts';

const navigation = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => navigation);

beforeEach(() => {
	navigation.goto.mockReset();
});

afterEach(() => {
	cleanup();
});

const filters = (query = '') => parseRecordFilters(new URLSearchParams(query));

const row: RankedRecord = {
	rank: 1,
	event: 'USAZGIQ',
	day: '2026-11-14',
	type: 'Qualifier',
	region: 'USAZ',
	key: 'q1',
	label: 'Q1',
	level: 'qual',
	alliance: 'red',
	teams: [3747, 724],
	opponents: [1, 2],
	result: 'win',
	total: 150,
	opponent: 120,
	auto: 30,
	teleop: 120,
	hive: 100,
	flower: 10,
	garden: 0,
	park: 10,
	tips: 4,
	fouls: 5,
	final: 155,
	margin: 30
};

function headerLink(name: string) {
	return screen.getByRole('link', { name: new RegExp(`^${name}$`) });
}

describe('records table sorting', () => {
	it('sorts a new column high to low, then flips the sorted column', () => {
		render(RecordTable, {
			props: { rows: [row], filters: filters(), names: { teams: {}, events: {} } }
		});
		expect(headerLink('Total')).toHaveAttribute('href', '/records?dir=asc');
		expect(headerLink('Hive')).toHaveAttribute('href', '/records?part=hive');
		expect(screen.getByRole('columnheader', { name: 'Total' })).toHaveAttribute(
			'aria-sort',
			'descending'
		);
	});

	it('marks a low to high sort and adds the sorted statistic', () => {
		render(RecordTable, {
			props: {
				rows: [row],
				filters: filters('part=margin&dir=asc'),
				names: { teams: {}, events: {} }
			}
		});
		expect(screen.getByRole('columnheader', { name: 'Margin' })).toHaveAttribute(
			'aria-sort',
			'ascending'
		);
		expect(headerLink('Margin')).toHaveAttribute('href', '/records?part=margin');
		expect(screen.queryByRole('columnheader', { name: 'Opponent' })).toBeNull();
		expect(screen.getByRole('cell', { name: '+30' })).toBeInTheDocument();
	});

	it('shows the rank on every row, ties included', () => {
		render(RecordTable, {
			props: {
				rows: [row, { ...row, key: 'q2', label: 'Q2' }],
				filters: filters(),
				names: { teams: {}, events: {} }
			}
		});
		expect(screen.getAllByRole('cell', { name: '1' })).toHaveLength(2);
	});

	it('says when nothing matches', () => {
		render(RecordTable, {
			props: { rows: [], filters: filters('part=hive&team=3747'), names: { teams: {}, events: {} } }
		});
		expect(screen.getByText('No scores match these filters.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
			'href',
			'/records?part=hive'
		);
	});
});

describe('custom filters', () => {
	it('applies a number condition and a statistic comparison', async () => {
		const ondone = vi.fn();
		render(RecordConditions, { props: { filters: filters(), ondone } });
		await fireEvent.change(screen.getByRole('combobox', { name: 'Statistic 1' }), {
			target: { value: 'hive' }
		});
		await fireEvent.input(screen.getByRole('spinbutton', { name: 'Number 1' }), {
			target: { value: '100' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add condition' }));
		await fireEvent.change(screen.getByRole('combobox', { name: 'Statistic 2' }), {
			target: { value: 'auto' }
		});
		await fireEvent.change(screen.getByRole('combobox', { name: 'Comparison 2' }), {
			target: { value: 'gt' }
		});
		await fireEvent.change(screen.getByRole('combobox', { name: 'Compare with 2' }), {
			target: { value: 'teleop' }
		});
		await fireEvent.change(screen.getByRole('combobox', { name: /Show scores that meet/ }), {
			target: { value: 'any' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
		expect(navigation.goto).toHaveBeenCalledWith(
			'/records?match=any&f=hive.gte.100&f=auto.gt.teleop',
			{ reset: false }
		);
		expect(ondone).toHaveBeenCalledWith(true);
	});

	it('clears every condition', async () => {
		render(RecordConditions, {
			props: { filters: filters('part=auto&f=hive.gt.10'), ondone: vi.fn() }
		});
		expect(screen.getByRole('spinbutton', { name: 'Number 1' })).toHaveValue(10);
		await fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
		expect(navigation.goto).toHaveBeenCalledWith('/records?part=auto', { reset: false });
	});
});
