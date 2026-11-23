import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PickList from '#lib/components/tools/PickList.svelte';
import type { PickList as PickListData } from '#lib/workspace/schemas.ts';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function list(...teams: number[]): PickListData {
	return {
		event: null,
		entries: teams.map((team) => ({ team, name: null, note: '', taken: false }))
	};
}

type Change = (list: PickListData) => PickListData;

function setup(initial: PickListData, extra: Record<string, unknown> = {}) {
	const state = { current: initial };
	const update = vi.fn((change: Change) => {
		state.current = change(state.current);
	});
	const view = render(PickList, { props: { list: initial, update, ...extra } });
	const refresh = () => view.rerender({ list: state.current, update, ...extra });
	return { state, update, refresh, view };
}

const order = (data: PickListData) => data.entries.map((entry) => entry.team);

describe('pick list', () => {
	it('shows the teams in order with their names and notes', () => {
		render(PickList, {
			props: {
				list: {
					event: null,
					entries: [
						{ team: 26128, name: 'Wrightly Reconfigured Robots', note: 'Best auto', taken: false },
						{ team: 2844, name: null, note: '', taken: false }
					]
				}
			}
		});
		const rows = screen.getAllByRole('listitem');
		expect(rows).toHaveLength(2);
		expect(rows[0]).toHaveTextContent('26128');
		expect(rows[0]).toHaveTextContent('Wrightly Reconfigured Robots');
		expect(rows[0]).toHaveTextContent('Best auto');
		expect(rows[1]).toHaveTextContent('2844');
	});

	it('explains an empty list', () => {
		setup(list());
		expect(screen.getByText('No teams yet.')).toBeInTheDocument();
	});

	it('adds a team by number', async () => {
		const { state, refresh } = setup(list(1));
		await fireEvent.input(screen.getByLabelText('Team number'), { target: { value: '14624' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Add team' }));
		expect(order(state.current)).toEqual([1, 14624]);
		await refresh();
		expect(screen.getByLabelText('Team number')).toHaveValue('');
		expect(screen.getAllByRole('listitem')).toHaveLength(2);
	});

	it('looks up the name of an added team', async () => {
		const lookupName = vi.fn(async () => 'Cat-Astrophic Byte');
		const { state } = setup(list(), { lookupName });
		await fireEvent.input(screen.getByLabelText('Team number'), { target: { value: '14624' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Add team' }));
		await vi.waitFor(() => expect(state.current.entries[0]?.name).toBe('Cat-Astrophic Byte'));
		expect(lookupName).toHaveBeenCalledWith(14624);
	});

	it('keeps the team when the name lookup fails', async () => {
		const lookupName = vi.fn(async () => {
			throw new Error('offline');
		});
		const { state } = setup(list(), { lookupName });
		await fireEvent.input(screen.getByLabelText('Team number'), { target: { value: '14624' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Add team' }));
		await vi.waitFor(() => expect(lookupName).toHaveBeenCalled());
		expect(order(state.current)).toEqual([14624]);
		expect(state.current.entries[0].name).toBeNull();
	});

	it('says when a team is already listed or the number is wrong', async () => {
		const { update } = setup(list(2844));
		const input = screen.getByLabelText('Team number');
		await fireEvent.input(input, { target: { value: '2844' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Add team' }));
		expect(screen.getByRole('alert')).toHaveTextContent('2844 is already on the list.');
		await fireEvent.input(input, { target: { value: 'abc' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Add team' }));
		expect(screen.getByRole('alert')).toHaveTextContent('Enter a team number, 1 to 6 digits.');
		expect(update).not.toHaveBeenCalled();
	});

	it('saves a note as it is typed', async () => {
		const { state } = setup(list(2844, 36980));
		await fireEvent.input(screen.getByLabelText('Note for 36980'), {
			target: { value: 'Launcher jammed in Q21' }
		});
		expect(state.current.entries[1].note).toBe('Launcher jammed in Q21');
		expect(state.current.entries[0].note).toBe('');
	});

	it('marks a team taken and back', async () => {
		const { state, refresh } = setup(list(2844));
		await fireEvent.click(screen.getByRole('button', { name: 'Mark taken' }));
		expect(state.current.entries[0].taken).toBe(true);
		await refresh();
		const button = screen.getByRole('button', { name: 'Taken' });
		expect(button).toHaveAttribute('aria-pressed', 'true');
		await fireEvent.click(button);
		expect(state.current.entries[0].taken).toBe(false);
	});

	it('removes a team', async () => {
		const { state } = setup(list(1, 2, 3));
		await fireEvent.click(screen.getByRole('button', { name: 'More for 2' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Remove 2' }));
		expect(order(state.current)).toEqual([1, 3]);
	});

	it('shows who took a team when alliance data says so', () => {
		setup(list(26128, 2844), { auto: new Map([[26128, 'Picked by alliance 3']]) });
		const rows = screen.getAllByRole('listitem');
		expect(rows[0]).toHaveTextContent('Picked by alliance 3');
		expect(within(rows[0]).queryByRole('button', { name: /taken/i })).toBeNull();
		expect(within(rows[1]).getByRole('button', { name: 'Mark taken' })).toBeInTheDocument();
	});

	it('links to the alliance selection page once an event is set', () => {
		render(PickList, { props: { list: { ...list(1), event: 'USAZGIQ' }, update: () => {} } });
		expect(screen.getByRole('link', { name: 'Open alliance selection' })).toHaveAttribute(
			'href',
			'/events/USAZGIQ/alliance-selection'
		);
		expect(screen.getByLabelText('Event code')).toHaveValue('USAZGIQ');
	});

	it('sets and clears the event code', async () => {
		const { state } = setup(list(1));
		const input = screen.getByLabelText('Event code');
		await fireEvent.change(input, { target: { value: 'usazgiq' } });
		expect(state.current.event).toBe('USAZGIQ');
		await fireEvent.change(input, { target: { value: '' } });
		expect(state.current.event).toBeNull();
		await fireEvent.change(input, { target: { value: 'not a code' } });
		expect(screen.getByRole('alert')).toHaveTextContent('Event codes use letters and numbers');
	});
});

describe('reordering with the keyboard', () => {
	it('moves a team up with the arrow key and announces it', async () => {
		const { state } = setup(list(1, 2, 3));
		const handle = screen.getByRole('button', { name: 'Move 3' });
		handle.focus();
		await fireEvent.keyDown(handle, { key: 'ArrowUp' });
		expect(order(state.current)).toEqual([1, 3, 2]);
		expect(screen.getByRole('status')).toHaveTextContent('3 moved to position 2 of 3.');
	});

	it('moves a team down, to the top and to the bottom', async () => {
		const { state, refresh } = setup(list(1, 2, 3, 4));
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Move 1' }), { key: 'ArrowDown' });
		expect(order(state.current)).toEqual([2, 1, 3, 4]);
		await refresh();
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Move 4' }), { key: 'Home' });
		expect(order(state.current)).toEqual([4, 2, 1, 3]);
		await refresh();
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Move 4' }), { key: 'End' });
		expect(order(state.current)).toEqual([2, 1, 3, 4]);
	});

	it('does nothing at the ends or for other keys', async () => {
		const { update } = setup(list(1, 2));
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Move 1' }), { key: 'ArrowUp' });
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Move 2' }), { key: 'ArrowDown' });
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Move 2' }), { key: 'a' });
		expect(update).not.toHaveBeenCalled();
	});

	it('keeps focus on the handle after a move', async () => {
		const { refresh } = setup(list(1, 2, 3));
		const handle = screen.getByRole('button', { name: 'Move 3' });
		handle.focus();
		await fireEvent.keyDown(handle, { key: 'ArrowUp' });
		await refresh();
		await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Move 3' })).toHaveFocus());
	});

	it('describes the handle for assistive technology', () => {
		setup(list(1, 2));
		const handle = screen.getByRole('button', { name: 'Move 1' });
		const help = document.getElementById(handle.getAttribute('aria-describedby') ?? '');
		expect(help).toHaveTextContent('press the up or down arrow key');
	});
});

describe('reordering by dragging', () => {
	function layout() {
		const rows = screen.getAllByRole('listitem');
		rows.forEach((row, index) => {
			vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
				top: index * 40,
				height: 40,
				bottom: index * 40 + 40,
				left: 0,
				right: 300,
				width: 300,
				x: 0,
				y: index * 40,
				toJSON: () => ({})
			});
		});
	}

	async function dragHandle(team: number, from: number, to: number) {
		const handle = screen.getByRole('button', { name: `Move ${team}` });
		await fireEvent.pointerDown(handle, {
			clientY: from,
			pointerId: 1,
			pointerType: 'mouse',
			button: 0
		});
		await fireEvent.pointerMove(handle, { clientY: to, pointerId: 1, pointerType: 'mouse' });
		return handle;
	}

	it('moves a team to the row it is dropped on', async () => {
		const { state } = setup(list(1, 2, 3, 4));
		layout();
		const handle = await dragHandle(1, 20, 110);
		await fireEvent.pointerUp(handle, { clientY: 110, pointerId: 1 });
		expect(order(state.current)).toEqual([2, 3, 1, 4]);
	});

	it('moves a team up', async () => {
		const { state } = setup(list(1, 2, 3, 4));
		layout();
		const handle = await dragHandle(4, 140, 30);
		await fireEvent.pointerUp(handle, { clientY: 30, pointerId: 1 });
		expect(order(state.current)).toEqual([1, 4, 2, 3]);
	});

	it('follows the pointer while dragging', async () => {
		setup(list(1, 2, 3));
		layout();
		await dragHandle(1, 20, 70);
		const row = screen.getAllByRole('listitem')[0];
		expect(row).toHaveClass('dragging');
		expect(row.style.transform).toBe('translateY(50px)');
	});

	it('leaves the order alone when the drag is cancelled or goes nowhere', async () => {
		const { update } = setup(list(1, 2, 3));
		layout();
		const handle = await dragHandle(1, 20, 25);
		await fireEvent.pointerUp(handle, { clientY: 25, pointerId: 1 });
		const second = await dragHandle(2, 60, 120);
		await fireEvent.pointerCancel(second, { pointerId: 1 });
		expect(update).not.toHaveBeenCalled();
		expect(screen.getAllByRole('listitem')[1]).not.toHaveClass('dragging');
	});

	it('ignores the right mouse button', async () => {
		const { update } = setup(list(1, 2, 3));
		layout();
		const handle = screen.getByRole('button', { name: 'Move 1' });
		await fireEvent.pointerDown(handle, {
			clientY: 20,
			pointerId: 1,
			pointerType: 'mouse',
			button: 2
		});
		await fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 });
		await fireEvent.pointerUp(handle, { clientY: 100, pointerId: 1 });
		expect(update).not.toHaveBeenCalled();
	});
});

describe('read only', () => {
	it('shows the list without any controls', () => {
		render(PickList, {
			props: {
				list: {
					event: 'USAZGIQ',
					entries: [{ team: 2844, name: 'Valley X Robotics', note: 'Strong auto', taken: true }]
				}
			}
		});
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('textbox')).toBeNull();
		expect(screen.getByText('Strong auto')).toBeInTheDocument();
		expect(screen.getByText('Taken')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Open alliance selection' })).toBeInTheDocument();
	});
});

describe('one handed controls', () => {
	it('moves a team with the up and down buttons', async () => {
		const { state, refresh } = setup(list(1, 2, 3));
		expect(screen.getByRole('button', { name: 'Move 1 up' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Move 3 down' })).toBeDisabled();
		await fireEvent.click(screen.getByRole('button', { name: 'Move 3 up' }));
		expect(order(state.current)).toEqual([1, 3, 2]);
		await refresh();
		await fireEvent.click(screen.getByRole('button', { name: 'Move 1 down' }));
		expect(order(state.current)).toEqual([3, 1, 2]);
		expect(screen.getByText('1 moved to position 2 of 3.')).toBeInTheDocument();
	});

	it('moves a team to the top from its menu', async () => {
		const { state } = setup(list(1, 2, 3));
		await fireEvent.click(screen.getByRole('button', { name: 'More for 3' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Move to top' }));
		expect(order(state.current)).toEqual([3, 1, 2]);
	});

	it('undoes a removal', async () => {
		const { state, refresh } = setup(list(1, 2, 3));
		await fireEvent.click(screen.getByRole('button', { name: 'More for 2' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Remove 2' }));
		await refresh();
		expect(screen.getByText('Removed 2.')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
		expect(order(state.current)).toEqual([1, 2, 3]);
		expect(screen.queryByText('Removed 2.')).toBeNull();
	});

	it('tags a team and shows the tags next to it', async () => {
		const { state, refresh } = setup(list(1));
		await fireEvent.click(screen.getByRole('button', { name: 'More for 1' }));
		const defense = screen.getByRole('button', { name: 'Defense' });
		expect(defense).toHaveAttribute('aria-pressed', 'false');
		await fireEvent.click(defense);
		expect(state.current.entries[0].tags).toEqual(['defense']);
		await refresh();
		expect(screen.getByRole('button', { name: 'Defense' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Defense');
	});

	it('keeps do not pick teams in their own section', async () => {
		const { state, refresh } = setup(list(1, 2));
		await fireEvent.click(screen.getByRole('button', { name: 'More for 1' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Do not pick' }));
		expect(state.current.entries.map((entry) => [entry.team, entry.avoid ?? false])).toEqual([
			[2, false],
			[1, true]
		]);
		await refresh();
		const avoid = screen.getByRole('heading', { name: 'Do not pick' }).nextElementSibling;
		expect(avoid).toHaveTextContent('1');
		expect(within(avoid as HTMLElement).queryByRole('button', { name: 'Move 1' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'More for 1' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Back to pick list' }));
		expect(state.current.entries[1].avoid).toBeUndefined();
	});
});

describe('keyboard focus', () => {
	function live(initial: PickListData) {
		const state = { current: initial };
		const view = render(PickList, {
			props: { list: initial, update: (change: Change) => apply(change) }
		});
		function apply(change: Change) {
			state.current = change(state.current);
			view.rerender({ list: state.current, update: (next: Change) => apply(next) });
		}
		return state;
	}

	it('moves focus to the handle when a move button runs out of room', async () => {
		live(list(1, 2, 3));
		const up = screen.getByRole('button', { name: 'Move 2 up' });
		up.focus();
		await fireEvent.click(up);
		await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Move 2' })).toHaveFocus());
	});

	it('moves focus to the next team after removing one', async () => {
		live(list(1, 2, 3));
		await fireEvent.click(screen.getByRole('button', { name: 'More for 2' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Remove 2' }));
		await vi.waitFor(() =>
			expect(screen.getByRole('button', { name: 'More for 3' })).toHaveFocus()
		);
	});

	it('closes the team menu on Escape and returns focus to More', async () => {
		live(list(1, 2));
		const more = screen.getByRole('button', { name: 'More for 1' });
		await fireEvent.click(more);
		const tag = screen.getByRole('button', { name: 'Strong auto' });
		tag.focus();
		await fireEvent.keyDown(tag, { key: 'Escape' });
		expect(more).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('button', { name: 'Strong auto' })).not.toBeInTheDocument();
		await vi.waitFor(() => expect(more).toHaveFocus());
	});

	it('follows a team into the do not pick section', async () => {
		live(list(1, 2));
		await fireEvent.click(screen.getByRole('button', { name: 'More for 1' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Do not pick' }));
		await vi.waitFor(() =>
			expect(screen.getByRole('button', { name: 'More for 1' })).toHaveFocus()
		);
	});
});

describe('stats and export', () => {
	it('shows OPR and rank next to each team', () => {
		setup(list(1, 2), { stats: new Map([[1, { opr: 45.25, rank: 3 }]]) });
		const rows = screen.getAllByRole('listitem');
		expect(rows[0]).toHaveTextContent('OPR 45.3 · #3');
		expect(rows[1]).not.toHaveTextContent('OPR');
	});

	it('uses season OPR for teams away from the event and explains a missing one', () => {
		setup(list(1, 2), {
			stats: new Map([
				[1, { opr: 30, rank: null, season: true }],
				[2, { opr: null, rank: null, season: true }]
			])
		});
		const rows = screen.getAllByRole('listitem');
		expect(rows[0]).toHaveTextContent('Season OPR 30.0');
		expect(rows[1]).toHaveTextContent('Not at this event, no season OPR yet');
	});

	it('copies the list as text', async () => {
		const writeText = vi.fn(async () => undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		setup({ ...list(1, 2), event: 'USAZGIQ' });
		await fireEvent.click(screen.getByRole('button', { name: 'Copy as text' }));
		expect(writeText).toHaveBeenCalledWith('Pick list, USAZGIQ\n1. 1\n2. 2');
		await vi.waitFor(() =>
			expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
		);
	});

	it('hides export and editing when read only', () => {
		render(PickList, { props: { list: list(1) } });
		expect(screen.queryByRole('button', { name: 'Copy as text' })).toBeNull();
		expect(screen.queryByRole('button', { name: /More/ })).toBeNull();
	});
});
