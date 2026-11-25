import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecordFilters from './RecordFilters.svelte';
import { parseRecordFilters } from './records.ts';

const navigation = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => navigation);

beforeEach(() => {
	navigation.goto.mockReset();
});

afterEach(() => {
	cleanup();
});

function setup(query = '') {
	const search = vi.fn(async () => [
		{ type: 'team' as const, label: '3747 The Hive', href: '/teams/3747' }
	]);
	render(RecordFilters, {
		props: {
			filters: parseRecordFilters(new URLSearchParams(query)),
			regions: [],
			types: [],
			search,
			delay: 0
		}
	});
	return { search, input: screen.getByRole('combobox', { name: 'Team' }) };
}

describe('record filters team field', () => {
	it('shows the team that is filtered on', () => {
		const { input } = setup('team=3747');
		expect(input).toHaveValue('3747');
	});

	it('filters by a team number typed in, as before', async () => {
		const { input } = setup();
		await fireEvent.input(input, { target: { value: '3747' } });
		await fireEvent.change(input);
		expect(navigation.goto).toHaveBeenCalledWith('?team=3747', { reset: false });
	});

	it('filters by a team picked by name', async () => {
		const { input } = setup();
		await fireEvent.input(input, { target: { value: 'hive' } });
		await fireEvent.change(input);
		expect(navigation.goto).not.toHaveBeenCalled();
		await fireEvent.click(await screen.findByRole('option', { name: /3747 The Hive/ }));
		await vi.waitFor(() =>
			expect(navigation.goto).toHaveBeenCalledWith('?team=3747', { reset: false })
		);
	});
});
