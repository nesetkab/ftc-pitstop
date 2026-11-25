import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StrategyBoard from '#lib/components/tools/StrategyBoard.svelte';
import type { Boards, Plan, Shape } from '#lib/workspace/schemas.ts';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

type Change = (boards: Boards) => Boards;

function plan(id: string, name: string, shapes: Shape[] = []): Plan {
	return { id, name, notes: '', shapes, updatedAt: Date.now() - 180_000 };
}

function setup(initial: Boards = { plans: [] }, extra: Record<string, unknown> = {}) {
	const state = { current: initial };
	const update = vi.fn((change: Change) => {
		state.current = change(state.current);
	});
	const props = () => ({ boards: state.current, update, ...extra });
	const view = render(StrategyBoard, { props: props() });
	return { state, update, refresh: () => view.rerender(props()) };
}

function field() {
	return screen.getByRole('img', { name: /BIOBUZZ field/ });
}

async function stroke(points: [number, number][]) {
	const [first, ...rest] = points;
	const target = field();
	await fireEvent.pointerDown(target, {
		clientX: first[0],
		clientY: first[1],
		pointerId: 1,
		pointerType: 'mouse',
		button: 0
	});
	for (const [x, y] of rest) {
		await fireEvent.pointerMove(target, {
			clientX: x,
			clientY: y,
			pointerId: 1,
			pointerType: 'mouse'
		});
	}
	const last = rest.at(-1) ?? first;
	await fireEvent.pointerUp(target, { clientX: last[0], clientY: last[1], pointerId: 1 });
}

const shapesOf = (boards: Boards) => boards.plans[0]?.shapes ?? [];

describe('strategy board', () => {
	it('draws the field map for light and dark themes', () => {
		setup();
		expect(screen.getByRole('img', { name: /^BIOBUZZ field/ })).toBeInTheDocument();
		const maps = field().querySelectorAll('image.map');
		expect(maps).toHaveLength(2);
		for (const map of maps) {
			expect(map.getAttribute('href')).toMatch(/biobuzz-(light|dark).*\.webp/);
			expect(map.getAttribute('width')).toBe('440');
		}
	});

	it('starts with the pen and can switch tools', async () => {
		setup();
		expect(screen.getByRole('button', { name: 'Pen' })).toHaveAttribute('aria-pressed', 'true');
		await fireEvent.click(screen.getByRole('button', { name: 'Arrow' }));
		expect(screen.getByRole('button', { name: 'Arrow' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: 'Pen' })).toHaveAttribute('aria-pressed', 'false');
	});

	it('switches tools from the keyboard', async () => {
		setup();
		const pen = screen.getByRole('button', { name: 'Pen' });
		pen.focus();
		await fireEvent.keyDown(pen, { key: 'e' });
		expect(screen.getByRole('button', { name: 'Erase' })).toHaveAttribute('aria-pressed', 'true');
	});

	it('draws a smoothed freehand stroke into a new plan', async () => {
		const { state } = setup();
		await stroke([
			[40, 40],
			[60, 40.4],
			[80, 40],
			[100, 40.5],
			[120, 40]
		]);
		expect(state.current.plans).toHaveLength(1);
		expect(state.current.plans[0].name).toBe('Plan 1');
		const [shape] = shapesOf(state.current);
		expect(shape).toMatchObject({ kind: 'pen', color: 'ink', dash: false, pts: [40, 40, 120, 40] });
	});

	it('draws a dot when the pen is only clicked', async () => {
		const { state } = setup();
		await stroke([[200, 200]]);
		expect(shapesOf(state.current)[0]).toMatchObject({ kind: 'pen', pts: [200, 200] });
	});

	it('uses the chosen color and dashed lines', async () => {
		const { state } = setup();
		await fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Dashed' }));
		await stroke([
			[10, 10],
			[200, 200]
		]);
		expect(shapesOf(state.current)[0]).toMatchObject({ color: 'blue', dash: true });
	});

	it('draws an arrow from where the pointer went down to where it came up', async () => {
		const { state } = setup();
		await fireEvent.click(screen.getByRole('button', { name: 'Arrow' }));
		await stroke([
			[100, 100],
			[200, 150]
		]);
		expect(shapesOf(state.current)[0]).toMatchObject({ kind: 'arrow', pts: [100, 100, 200, 150] });
	});

	it('ignores an arrow that is only a click', async () => {
		const { state } = setup();
		await fireEvent.click(screen.getByRole('button', { name: 'Arrow' }));
		await stroke([[100, 100]]);
		expect(state.current.plans).toEqual([]);
	});

	it('places a robot marker with the team number and lets it be moved', async () => {
		const { state, refresh } = setup({ plans: [] }, { team: 14624 });
		await fireEvent.click(screen.getByRole('button', { name: 'Robot' }));
		await stroke([[300, 300]]);
		expect(shapesOf(state.current)[0]).toMatchObject({
			kind: 'robot',
			x: 300,
			y: 300,
			label: '14624'
		});
		await refresh();
		await stroke([
			[302, 298],
			[350, 340]
		]);
		expect(shapesOf(state.current)).toHaveLength(1);
		expect(shapesOf(state.current)[0]).toMatchObject({ kind: 'robot', x: 348, y: 342 });
	});

	it('labels a marker with the number typed in the side panel', async () => {
		const { state } = setup({ plans: [] }, { team: 14624 });
		await fireEvent.input(screen.getByLabelText('Robot number'), { target: { value: '25620' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Robot' }));
		await stroke([[100, 400]]);
		expect(shapesOf(state.current)[0]).toMatchObject({ label: '25620' });
	});

	it('labels a marker with a team picked by name', async () => {
		const search = vi.fn(async () => [
			{ type: 'team' as const, label: '25620 Gear Ticks', href: '/teams/25620' }
		]);
		const { state } = setup({ plans: [] }, { team: 14624, search });
		const input = screen.getByLabelText('Robot number');
		await fireEvent.input(input, { target: { value: 'gear ticks' } });
		await fireEvent.click(await screen.findByRole('option', { name: /25620 Gear Ticks/ }));
		expect(input).toHaveValue('25620');
		await fireEvent.click(screen.getByRole('button', { name: 'Robot' }));
		await stroke([[100, 400]]);
		expect(shapesOf(state.current)[0]).toMatchObject({ label: '25620' });
	});

	it('keeps the team number on a marker while a name is half typed', async () => {
		const search = vi.fn(async () => []);
		const { state } = setup({ plans: [] }, { team: 14624, search });
		await fireEvent.input(screen.getByLabelText('Robot number'), { target: { value: 'gea' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Robot' }));
		await stroke([[100, 400]]);
		expect(shapesOf(state.current)[0]).toMatchObject({ label: '14624' });
	});

	it('adds text where the field is clicked', async () => {
		const { state } = setup();
		await fireEvent.click(screen.getByRole('button', { name: 'Text' }));
		await stroke([[120, 200]]);
		const input = screen.getByLabelText('Text on the field');
		expect(input).toHaveFocus();
		await fireEvent.input(input, { target: { value: 'Park with 20 s left' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(shapesOf(state.current)[0]).toMatchObject({
			kind: 'text',
			x: 120,
			y: 200,
			text: 'Park with 20 s left'
		});
		expect(screen.queryByLabelText('Text on the field')).toBeNull();
	});

	it('drops text that was cancelled or left empty', async () => {
		const { update } = setup();
		await fireEvent.click(screen.getByRole('button', { name: 'Text' }));
		await stroke([[120, 200]]);
		await fireEvent.keyDown(screen.getByLabelText('Text on the field'), { key: 'Escape' });
		await stroke([[120, 200]]);
		await fireEvent.keyDown(screen.getByLabelText('Text on the field'), { key: 'Enter' });
		expect(update).not.toHaveBeenCalled();
	});

	it('erases the mark under the pointer', async () => {
		const near: Shape = {
			id: 'a',
			kind: 'pen',
			color: 'ink',
			dash: false,
			pts: [0, 100, 200, 100]
		};
		const far: Shape = { id: 'b', kind: 'pen', color: 'ink', dash: false, pts: [0, 300, 200, 300] };
		const { state } = setup({ plans: [plan('p1', 'Plan 1', [near, far])] });
		await fireEvent.click(screen.getByRole('button', { name: 'Erase' }));
		await stroke([
			[50, 102],
			[60, 101]
		]);
		expect(shapesOf(state.current).map((shape) => shape.id)).toEqual(['b']);
	});

	it('undoes and redoes a mark', async () => {
		const { state, refresh } = setup();
		await stroke([
			[10, 10],
			[200, 200]
		]);
		await refresh();
		expect(shapesOf(state.current)).toHaveLength(1);
		await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
		expect(shapesOf(state.current)).toHaveLength(0);
		await refresh();
		await fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
		expect(shapesOf(state.current)).toHaveLength(1);
		await refresh();
		expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
	});

	it('undoes with the keyboard shortcut', async () => {
		const { state, refresh } = setup();
		await stroke([
			[10, 10],
			[200, 200]
		]);
		await refresh();
		const pen = screen.getByRole('button', { name: 'Pen' });
		pen.focus();
		await fireEvent.keyDown(pen, { key: 'z', ctrlKey: true });
		expect(shapesOf(state.current)).toHaveLength(0);
	});

	it('clears everything and brings it back with undo', async () => {
		const marks: Shape[] = [
			{ id: 'a', kind: 'pen', color: 'ink', dash: false, pts: [0, 0, 5, 5] },
			{ id: 'b', kind: 'robot', color: 'red', x: 50, y: 50, label: '1' }
		];
		const { state, refresh } = setup({ plans: [plan('p1', 'Plan 1', marks)] });
		await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
		expect(shapesOf(state.current)).toHaveLength(0);
		await refresh();
		await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
		expect(
			shapesOf(state.current)
				.map((shape) => shape.id)
				.sort()
		).toEqual(['a', 'b']);
	});

	it('keeps several plans and switches between them', async () => {
		const first = plan('p1', 'Q26 plan', [
			{ id: 'a', kind: 'robot', color: 'red', x: 50, y: 50, label: '1' }
		]);
		const { state, refresh } = setup({ plans: [first, plan('p2', 'Q31 plan')] });
		const list = screen.getByRole('list');
		expect(within(list).getAllByRole('button')).toHaveLength(2);
		expect(field().querySelectorAll('.robot')).toHaveLength(1);
		await fireEvent.click(within(list).getByRole('button', { name: /Q31 plan/ }));
		expect(field().querySelectorAll('.robot')).toHaveLength(0);
		await stroke([
			[10, 10],
			[100, 100]
		]);
		expect(state.current.plans[1].shapes).toHaveLength(1);
		expect(state.current.plans[0].shapes).toHaveLength(1);
		await refresh();
		expect(
			within(screen.getByRole('list')).getByRole('button', { name: /Q31 plan/ })
		).toHaveAttribute('aria-current', 'true');
	});

	it('makes, renames, duplicates and deletes plans', async () => {
		const { state, refresh } = setup({ plans: [plan('p1', 'Plan 1')] });
		await fireEvent.click(screen.getByRole('button', { name: 'New plan' }));
		expect(state.current.plans.map((item) => item.name)).toEqual(['Plan 1', 'Plan 2']);
		await refresh();
		await fireEvent.input(screen.getByLabelText('Plan name'), {
			target: { value: 'Playoff default' }
		});
		expect(state.current.plans[1].name).toBe('Playoff default');
		await refresh();
		await fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
		expect(state.current.plans.map((item) => item.name)).toEqual([
			'Plan 1',
			'Playoff default',
			'Playoff default copy'
		]);
		await refresh();
		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		expect(state.current.plans).toHaveLength(3);
		await refresh();
		await fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
		expect(state.current.plans.map((item) => item.name)).toEqual(['Plan 1', 'Playoff default']);
	});

	it('saves notes with the plan', async () => {
		const { state } = setup({ plans: [plan('p1', 'Plan 1')] });
		await fireEvent.input(screen.getByLabelText('Notes'), {
			target: { value: '14624 takes the left' }
		});
		expect(state.current.plans[0].notes).toBe('14624 takes the left');
	});

	it('offers a share link only when there is a plan to share', async () => {
		setup({ plans: [] }, { shareContext: { from: 'ABCD3F', team: 14624 } });
		expect(screen.queryByRole('button', { name: 'Copy share link' })).toBeNull();
		cleanup();
		setup({ plans: [plan('p1', 'Plan 1')] }, { shareContext: { from: 'ABCD3F', team: 14624 } });
		expect(screen.getByRole('button', { name: 'Copy share link' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Export PNG' })).toBeInTheDocument();
	});

	it('stops adding marks when a plan is full', async () => {
		const marks: Shape[] = Array.from({ length: 400 }, (_, index) => ({
			id: `s${index}`,
			kind: 'pen',
			color: 'ink',
			dash: false,
			pts: [0, 0, 5, 5]
		}));
		const { state } = setup({ plans: [plan('p1', 'Plan 1', marks)] });
		expect(screen.getByRole('alert')).toHaveTextContent('This plan is full.');
		await stroke([
			[10, 10],
			[200, 200]
		]);
		expect(shapesOf(state.current)).toHaveLength(400);
	});

	it('shows a read only plan without tools', () => {
		render(StrategyBoard, {
			props: {
				boards: {
					plans: [
						{
							...plan('p1', 'Q26 plan', [
								{ id: 'a', kind: 'text', color: 'red', x: 100, y: 100, text: 'Hive frame' }
							]),
							notes: 'Left side first'
						}
					]
				}
			}
		});
		expect(screen.queryByRole('toolbar')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Pen' })).toBeNull();
		expect(screen.getByRole('heading', { name: 'Q26 plan' })).toBeInTheDocument();
		expect(screen.getByText('Left side first')).toBeInTheDocument();
		expect(field().querySelector('text.note')).toHaveTextContent('Hive frame');
	});
});
