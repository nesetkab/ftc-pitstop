import { describe, expect, it } from 'vitest';
import {
	addPlan,
	applyOp,
	arrowParts,
	blankPlan,
	clientToField,
	defaultPlanName,
	distanceToSegment,
	duplicatePlan,
	EMPTY_HISTORY,
	hitMovable,
	hitTest,
	invertOp,
	isFull,
	record,
	removePlan,
	renamePlan,
	setPlanNotes,
	simplify,
	smoothPath,
	stepBack,
	stepForward,
	thin,
	upsertPlan,
	type BoardOp
} from '#lib/workspace/board.ts';
import { parseDoc, type Boards, type Shape } from '#lib/workspace/schemas.ts';

const NOW = 1_700_000_000_000;

const pen = (id: string, pts: number[]): Shape => ({
	id,
	kind: 'pen',
	color: 'ink',
	dash: false,
	pts
});
const robot = (id: string, x: number, y: number): Shape => ({
	id,
	kind: 'robot',
	color: 'red',
	x,
	y,
	label: '14624'
});
const label = (id: string, x: number, y: number, text: string): Shape => ({
	id,
	kind: 'text',
	color: 'ink',
	x,
	y,
	text
});
const arrow = (id: string): Shape => ({
	id,
	kind: 'arrow',
	color: 'blue',
	dash: false,
	pts: [100, 100, 200, 100]
});

function boards(...shapes: Shape[]): Boards {
	return { plans: [{ id: 'p1', name: 'Plan 1', notes: '', shapes, updatedAt: 0 }] };
}

describe('coordinates', () => {
	const box = { left: 100, top: 50, width: 240, height: 240 };

	it('maps the page position onto the 480 unit field', () => {
		expect(clientToField(box, 100, 50)).toEqual({ x: 0, y: 0 });
		expect(clientToField(box, 220, 170)).toEqual({ x: 240, y: 240 });
		expect(clientToField(box, 340, 290)).toEqual({ x: 480, y: 480 });
		expect(clientToField(box, 160, 110)).toEqual({ x: 120, y: 120 });
	});

	it('clamps points that leave the field and rounds to a tenth', () => {
		expect(clientToField(box, -500, 9000)).toEqual({ x: -10, y: 490 });
		expect(clientToField(box, 101, 51)).toEqual({ x: 2, y: 2 });
		expect(clientToField(box, 100.37, 50)).toEqual({ x: 0.7, y: 0 });
	});

	it('survives a box with no size', () => {
		expect(clientToField({ left: 0, top: 0, width: 0, height: 0 }, 10, 20)).toEqual({
			x: 10,
			y: 20
		});
	});

	it('measures distance to a segment', () => {
		expect(distanceToSegment({ x: 5, y: 5 }, 0, 0, 10, 0)).toBe(5);
		expect(distanceToSegment({ x: -3, y: 4 }, 0, 0, 10, 0)).toBe(5);
		expect(distanceToSegment({ x: 14, y: 3 }, 0, 0, 10, 0)).toBe(5);
		expect(distanceToSegment({ x: 3, y: 4 }, 0, 0, 0, 0)).toBe(5);
	});
});

describe('freehand strokes', () => {
	it('drops points that are almost on the line between their neighbours', () => {
		const line = [0, 0, 10, 0.2, 20, -0.1, 30, 0.1, 40, 0];
		expect(simplify(line, 1)).toEqual([0, 0, 40, 0]);
	});

	it('keeps the corners of a path', () => {
		const corner = [0, 0, 20, 0, 40, 0, 40, 20, 40, 40];
		expect(simplify(corner, 1)).toEqual([0, 0, 40, 0, 40, 40]);
	});

	it('leaves short strokes alone and rounds them', () => {
		expect(simplify([1.234, 5.678], 1)).toEqual([1.2, 5.7]);
		expect(simplify([0, 0, 10.04, 10.06], 1)).toEqual([0, 0, 10, 10.1]);
	});

	it('thins points that are too close together', () => {
		expect(thin([0, 0, 0.5, 0.5, 3, 0, 3.2, 0.1, 6, 0], 2)).toEqual([0, 0, 3, 0, 6, 0]);
	});

	it('builds a smooth path through midpoints', () => {
		expect(smoothPath([])).toBe('');
		expect(smoothPath([5, 6])).toBe('M5 6L5 6');
		expect(smoothPath([0, 0, 10, 10])).toBe('M0 0L10 10');
		expect(smoothPath([0, 0, 10, 10, 20, 0])).toBe('M0 0Q10 10 15 5L20 0');
		expect(smoothPath([0, 0, 10, 0, 20, 10, 30, 10])).toBe('M0 0Q10 0 15 5Q20 10 25 10L30 10');
	});
});

describe('arrows', () => {
	it('stops the line at the base of the head', () => {
		const { line, head } = arrowParts([0, 0, 100, 0]);
		expect(line).toBe('M0 0L84 0');
		expect(head).toBe('M100 0L84 8L84 -8Z');
	});

	it('handles any direction', () => {
		const { head } = arrowParts([0, 0, 0, 100]);
		expect(head.startsWith('M0 100L')).toBe(true);
	});

	it('shrinks the head on short arrows and survives zero length', () => {
		expect(arrowParts([0, 0, 10, 0]).line).toBe('M0 0L2 0');
		expect(arrowParts([5, 5, 5, 5])).toEqual({ line: 'M5 5L5 5', head: '' });
	});
});

describe('hit testing', () => {
	it('finds a pen stroke near its line', () => {
		const shapes = [pen('a', [0, 0, 100, 0])];
		expect(hitTest(shapes, { x: 50, y: 6 }, 8)).toBe('a');
		expect(hitTest(shapes, { x: 50, y: 20 }, 8)).toBeNull();
	});

	it('finds a single dot', () => {
		expect(hitTest([pen('a', [40, 40])], { x: 44, y: 40 }, 8)).toBe('a');
	});

	it('finds arrows, robots and text', () => {
		const shapes = [arrow('a'), robot('r', 300, 300), label('t', 50, 400, 'Hive frame')];
		expect(hitTest(shapes, { x: 150, y: 103 }, 8)).toBe('a');
		expect(hitTest(shapes, { x: 310, y: 290 }, 8)).toBe('r');
		expect(hitTest(shapes, { x: 90, y: 395 }, 8)).toBe('t');
		expect(hitTest(shapes, { x: 90, y: 300 }, 8)).toBeNull();
	});

	it('prefers the shape drawn last', () => {
		const shapes = [pen('under', [0, 0, 100, 0]), pen('over', [0, 2, 100, 2])];
		expect(hitTest(shapes, { x: 50, y: 1 }, 8)).toBe('over');
	});

	it('only lets robots and text be picked up', () => {
		const shapes = [pen('p', [0, 0, 100, 0]), robot('r', 50, 0)];
		expect(hitMovable(shapes, { x: 50, y: 0 })?.id).toBe('r');
		expect(hitMovable(shapes, { x: 10, y: 0 })).toBeNull();
	});
});

describe('board operations', () => {
	it('adds shapes once and stamps the plan', () => {
		const add: BoardOp = { type: 'add', plan: 'p1', shapes: [pen('a', [0, 0, 5, 5])] };
		const next = applyOp(boards(), add, NOW);
		expect(next.plans[0].shapes.map((shape) => shape.id)).toEqual(['a']);
		expect(next.plans[0].updatedAt).toBe(NOW);
		expect(applyOp(next, add, NOW).plans[0].shapes).toHaveLength(1);
	});

	it('removes shapes by id', () => {
		const start = boards(pen('a', [0, 0, 5, 5]), robot('r', 10, 10));
		const next = applyOp(start, { type: 'remove', plan: 'p1', shapes: [robot('r', 10, 10)] }, NOW);
		expect(next.plans[0].shapes.map((shape) => shape.id)).toEqual(['a']);
	});

	it('moves robots and text but not strokes', () => {
		const start = boards(robot('r', 10, 10), pen('a', [0, 0, 5, 5]));
		const moved = applyOp(
			start,
			{ type: 'move', plan: 'p1', id: 'r', from: { x: 10, y: 10 }, to: { x: 99, y: 88 } },
			NOW
		);
		expect(moved.plans[0].shapes[0]).toMatchObject({ x: 99, y: 88 });
		const stroke = applyOp(
			start,
			{ type: 'move', plan: 'p1', id: 'a', from: { x: 0, y: 0 }, to: { x: 9, y: 9 } },
			NOW
		);
		expect(stroke.plans[0].shapes[1]).toEqual(start.plans[0].shapes[1]);
	});

	it('leaves other plans alone', () => {
		const start: Boards = {
			plans: [blankPlan('p1', 'One', 0), blankPlan('p2', 'Two', 0)]
		};
		const next = applyOp(start, { type: 'add', plan: 'p2', shapes: [pen('a', [0, 0])] }, NOW);
		expect(next.plans[0].shapes).toEqual([]);
		expect(next.plans[1].shapes).toHaveLength(1);
	});

	it('caps the number of shapes in a plan', () => {
		const many = Array.from({ length: 405 }, (_, index) => pen(`s${index}`, [0, 0]));
		const next = applyOp(boards(), { type: 'add', plan: 'p1', shapes: many }, NOW);
		expect(next.plans[0].shapes).toHaveLength(400);
		expect(isFull(next.plans[0])).toBe(true);
		expect(isFull(boards().plans[0])).toBe(false);
	});

	it('inverts each kind of operation', () => {
		const shapes = [pen('a', [0, 0])];
		const add: BoardOp = { type: 'add', plan: 'p1', shapes };
		expect(invertOp(add)).toEqual({ type: 'remove', plan: 'p1', shapes });
		expect(invertOp(invertOp(add))).toEqual(add);
		const move: BoardOp = {
			type: 'move',
			plan: 'p1',
			id: 'r',
			from: { x: 1, y: 2 },
			to: { x: 3, y: 4 }
		};
		expect(invertOp(move)).toEqual({
			type: 'move',
			plan: 'p1',
			id: 'r',
			from: { x: 3, y: 4 },
			to: { x: 1, y: 2 }
		});
	});
});

describe('undo and redo', () => {
	const add = (id: string): BoardOp => ({ type: 'add', plan: 'p1', shapes: [pen(id, [0, 0])] });

	it('steps back through operations and forward again', () => {
		let history = record(record(EMPTY_HISTORY, add('a')), add('b'));
		let current = applyOp(applyOp(boards(), add('a'), NOW), add('b'), NOW);
		const back = stepBack(history);
		history = back.history;
		current = applyOp(current, back.op!, NOW);
		expect(current.plans[0].shapes.map((shape) => shape.id)).toEqual(['a']);
		const forward = stepForward(history);
		history = forward.history;
		current = applyOp(current, forward.op!, NOW);
		expect(current.plans[0].shapes.map((shape) => shape.id)).toEqual(['a', 'b']);
		expect(history.redo).toEqual([]);
	});

	it('forgets the redo stack when something new is drawn', () => {
		const history = record(record(EMPTY_HISTORY, add('a')), add('b'));
		const { history: undone } = stepBack(history);
		expect(undone.redo).toHaveLength(1);
		expect(record(undone, add('c')).redo).toEqual([]);
	});

	it('does nothing when there is nothing to undo or redo', () => {
		expect(stepBack(EMPTY_HISTORY)).toEqual({ history: EMPTY_HISTORY, op: null });
		expect(stepForward(EMPTY_HISTORY)).toEqual({ history: EMPTY_HISTORY, op: null });
	});

	it('keeps the last hundred steps', () => {
		let history = EMPTY_HISTORY;
		for (let i = 0; i < 130; i++) history = record(history, add(`s${i}`));
		expect(history.undo).toHaveLength(100);
	});
});

describe('plans', () => {
	it('names plans in order', () => {
		expect(defaultPlanName({ plans: [] })).toBe('Plan 1');
		expect(
			defaultPlanName({ plans: [blankPlan('a', 'Plan 1', 0), blankPlan('b', 'Q26', 0)] })
		).toBe('Plan 3');
		expect(defaultPlanName({ plans: [blankPlan('a', 'Plan 7', 0)] })).toBe('Plan 8');
	});

	it('adds, renames, annotates and removes plans', () => {
		let next = addPlan({ plans: [] }, blankPlan('a', 'First', 0));
		next = addPlan(next, blankPlan('b', 'Second', 0));
		expect(addPlan(next, blankPlan('b', 'Again', 0))).toBe(next);
		next = renamePlan(next, 'a', 'Q26 plan', NOW);
		next = setPlanNotes(next, 'a', 'Left side first', NOW);
		expect(next.plans[0]).toMatchObject({
			name: 'Q26 plan',
			notes: 'Left side first',
			updatedAt: NOW
		});
		next = removePlan(next, 'a');
		expect(next.plans.map((plan) => plan.id)).toEqual(['b']);
	});

	it('duplicates a plan with its shapes', () => {
		const start = boards(pen('a', [0, 0, 5, 5]));
		const next = duplicatePlan(start, 'p1', 'copy', NOW);
		expect(next.plans).toHaveLength(2);
		expect(next.plans[1]).toMatchObject({ id: 'copy', name: 'Plan 1 copy', updatedAt: NOW });
		expect(next.plans[1].shapes).toEqual(start.plans[0].shapes);
		expect(duplicatePlan(start, 'nope', 'copy', NOW)).toBe(start);
	});

	it('replaces a plan with the same id or appends a new one', () => {
		const start = boards(pen('a', [0, 0]));
		const replaced = upsertPlan(start, { ...start.plans[0], name: 'Renamed' });
		expect(replaced.plans).toHaveLength(1);
		expect(replaced.plans[0].name).toBe('Renamed');
		expect(upsertPlan(start, blankPlan('other', 'Other', 0)).plans).toHaveLength(2);
	});

	it('stops at thirty plans', () => {
		let next: Boards = { plans: [] };
		for (let i = 0; i < 35; i++) next = addPlan(next, blankPlan(`p${i}`, `P${i}`, 0));
		expect(next.plans).toHaveLength(30);
	});
});

describe('saved board colors', () => {
	it('reads the retired yellow pen as green', () => {
		const shape = { id: 'a', kind: 'pen', color: 'accent', dash: false, pts: [0, 0, 10, 10] };
		const parsed = parseDoc('boards', { plans: [{ id: 'p', name: 'Plan', shapes: [shape] }] });
		expect(parsed?.plans[0].shapes[0].color).toBe('green');
	});
});
