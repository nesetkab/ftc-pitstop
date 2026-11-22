import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Checklist from '#lib/components/tools/Checklist.svelte';
import type { Checklist as ChecklistData } from '#lib/workspace/schemas.ts';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function checklist(...texts: string[]): ChecklistData {
	return {
		match: 'Q26',
		items: texts.map((text, index) => ({ id: `i${index + 1}`, text, by: null, at: null })),
		history: []
	};
}

type Change = (list: ChecklistData) => ChecklistData;

function setup(initial: ChecklistData, extra: Record<string, unknown> = {}) {
	const state = { current: initial, initials: '' };
	const update = vi.fn((change: Change) => {
		state.current = change(state.current);
	});
	const oninitials = vi.fn((value: string) => {
		state.initials = value;
	});
	const props = () => ({
		checklist: state.current,
		initials: state.initials,
		update,
		oninitials,
		...extra
	});
	const view = render(Checklist, { props: props() });
	return { state, update, oninitials, refresh: () => view.rerender(props()) };
}

describe('checklist', () => {
	it('names the match and counts progress', () => {
		setup(checklist('Battery in', 'Pollen loaded'));
		expect(screen.getByRole('heading', { name: 'Before Q26' })).toBeInTheDocument();
		expect(screen.getByText('0 of 2 checked')).toBeInTheDocument();
	});

	it('asks for initials before the first check and then applies it', async () => {
		const { state, oninitials, refresh } = setup(checklist('Battery in'));
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Battery in' }));
		expect(state.current.items[0].at).toBeNull();
		expect(screen.getByRole('alert')).toHaveTextContent('Add your initials to check items.');
		await fireEvent.change(screen.getByLabelText('Your initials'), { target: { value: 'al' } });
		expect(oninitials).toHaveBeenCalledWith('AL');
		expect(state.current.items[0]).toMatchObject({ by: 'AL' });
		expect(state.current.items[0].at).not.toBeNull();
		await refresh();
		expect(screen.getByRole('checkbox', { name: 'Battery in' })).toBeChecked();
		expect(screen.getByText(/^AL /)).toBeInTheDocument();
	});

	it('stores who checked an item and when', async () => {
		const { state, refresh } = setup(checklist('Battery in', 'Pollen loaded'));
		state.initials = 'JR';
		await refresh();
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Pollen loaded' }));
		expect(state.current.items[1]).toMatchObject({ by: 'JR' });
		expect(state.current.items[1].at).toBeGreaterThan(0);
		expect(state.current.items[0].at).toBeNull();
		await refresh();
		expect(screen.getByText('1 of 2 checked')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Pollen loaded' }));
		expect(state.current.items[1]).toMatchObject({ by: null, at: null });
	});

	it('resets the checks for the next match and keeps a record', async () => {
		const { state, refresh } = setup(checklist('Battery in', 'Pollen loaded'));
		state.initials = 'AL';
		await refresh();
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Battery in' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Reset for next match' }));
		expect(state.current.match).toBe('Q27');
		expect(state.current.items.every((item) => item.at === null)).toBe(true);
		expect(state.current.history[0]).toMatchObject({ match: 'Q26', done: 1, total: 2, by: ['AL'] });
		await refresh();
		expect(screen.getByRole('heading', { name: 'Before Q27' })).toBeInTheDocument();
		expect(screen.getByText('Earlier matches')).toBeInTheDocument();
		expect(screen.getByText('1 of 2 checked by AL')).toBeInTheDocument();
	});

	it('offers example items on an empty list', async () => {
		const { state } = setup(checklist());
		expect(screen.getByText('No items yet.')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Add example items' }));
		expect(state.current.items.length).toBeGreaterThan(3);
	});

	it('edits the list', async () => {
		const { state, refresh } = setup(checklist('Battery in', 'Pollen loaded'));
		await fireEvent.click(screen.getByRole('button', { name: 'Edit items' }));
		await fireEvent.input(screen.getByLabelText('Item 1'), {
			target: { value: 'Battery in and tight' }
		});
		expect(state.current.items[0].text).toBe('Battery in and tight');
		await fireEvent.input(screen.getByLabelText('New item'), {
			target: { value: 'Driver hub charged' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
		expect(state.current.items.map((item) => item.text)).toEqual([
			'Battery in and tight',
			'Pollen loaded',
			'Driver hub charged'
		]);
		await refresh();
		await fireEvent.click(screen.getByRole('button', { name: 'Move item 3 up' }));
		expect(state.current.items[1].text).toBe('Driver hub charged');
		await refresh();
		await fireEvent.click(screen.getByRole('button', { name: 'Remove item 1' }));
		expect(state.current.items).toHaveLength(2);
	});

	it('shows a read only copy', () => {
		render(Checklist, {
			props: {
				checklist: {
					match: 'Q26',
					items: [{ id: 'a', text: 'Battery in', by: 'AL', at: 1_700_000_000_000 }],
					history: []
				}
			}
		});
		expect(screen.getByRole('checkbox', { name: 'Battery in' })).toBeDisabled();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByLabelText('Your initials')).toBeNull();
	});
});

describe('undo', () => {
	it('brings back the checks after an accidental reset', async () => {
		const start = checklist('Battery in', 'Pollen loaded');
		start.items[0] = { ...start.items[0], by: 'AL', at: 1_700_000_000_000 };
		const { state, refresh } = setup(start);
		await fireEvent.click(screen.getByRole('button', { name: 'Reset for next match' }));
		expect(state.current.match).toBe('Q27');
		await refresh();
		await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
		expect(state.current.match).toBe('Q26');
		expect(state.current.items[0].by).toBe('AL');
		expect(state.current.history).toEqual([]);
	});

	it('brings back a removed item', async () => {
		const { state, refresh } = setup(checklist('Battery in', 'Pollen loaded'));
		await fireEvent.click(screen.getByRole('button', { name: 'Edit items' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Remove item 1' }));
		expect(state.current.items).toHaveLength(1);
		await refresh();
		await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
		expect(state.current.items.map((item) => item.text)).toEqual(['Battery in', 'Pollen loaded']);
	});
});
