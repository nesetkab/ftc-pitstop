import { LIMITS, type Boards, type Plan, type Shape } from '#lib/workspace/schemas.ts';

export const FIELD_SIZE = 480;
export const FIELD_MIN = -10;
export const FIELD_MAX = 490;
export const ROBOT_SIZE = 30;
export const TEXT_SIZE = 15;
export const STROKE_WIDTH = 4;

const TEXT_WIDTH = 8.6;
const HISTORY_LIMIT = 100;

export interface Point {
	x: number;
	y: number;
}

export interface Box {
	left: number;
	top: number;
	width: number;
	height: number;
}

export function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

function clamp(value: number): number {
	return Math.min(Math.max(value, FIELD_MIN), FIELD_MAX);
}

export function clientToField(box: Box, clientX: number, clientY: number): Point {
	const x = ((clientX - box.left) / (box.width || FIELD_SIZE)) * FIELD_SIZE;
	const y = ((clientY - box.top) / (box.height || FIELD_SIZE)) * FIELD_SIZE;
	return { x: round1(clamp(x)), y: round1(clamp(y)) };
}

export function distanceToSegment(
	p: Point,
	ax: number,
	ay: number,
	bx: number,
	by: number
): number {
	const dx = bx - ax;
	const dy = by - ay;
	const lengthSquared = dx * dx + dy * dy;
	const t =
		lengthSquared === 0
			? 0
			: Math.min(Math.max(((p.x - ax) * dx + (p.y - ay) * dy) / lengthSquared, 0), 1);
	return Math.hypot(p.x - (ax + t * dx), p.y - (ay + t * dy));
}

export function simplify(values: readonly number[], epsilon: number): number[] {
	const count = Math.floor(values.length / 2);
	if (count <= 2) return values.map(round1);
	const keep = new Uint8Array(count);
	keep[0] = 1;
	keep[count - 1] = 1;
	const stack: [number, number][] = [[0, count - 1]];
	for (let range = stack.pop(); range; range = stack.pop()) {
		const [first, last] = range;
		let widest = 0;
		let index = -1;
		for (let i = first + 1; i < last; i++) {
			const distance = distanceToSegment(
				{ x: values[i * 2], y: values[i * 2 + 1] },
				values[first * 2],
				values[first * 2 + 1],
				values[last * 2],
				values[last * 2 + 1]
			);
			if (distance > widest) {
				widest = distance;
				index = i;
			}
		}
		if (index !== -1 && widest > epsilon) {
			keep[index] = 1;
			stack.push([first, index], [index, last]);
		}
	}
	const result: number[] = [];
	for (let i = 0; i < count; i++) {
		if (keep[i]) result.push(round1(values[i * 2]), round1(values[i * 2 + 1]));
	}
	return result;
}

export function thin(values: readonly number[], minimum: number): number[] {
	const result: number[] = [];
	for (let i = 0; i + 1 < values.length; i += 2) {
		const last = result.length;
		if (
			last === 0 ||
			Math.hypot(values[i] - result[last - 2], values[i + 1] - result[last - 1]) >= minimum
		) {
			result.push(values[i], values[i + 1]);
		}
	}
	return result;
}

export function smoothPath(values: readonly number[]): string {
	const count = Math.floor(values.length / 2);
	if (count === 0) return '';
	const x = (i: number) => values[i * 2];
	const y = (i: number) => values[i * 2 + 1];
	if (count === 1) return `M${x(0)} ${y(0)}L${x(0)} ${y(0)}`;
	if (count === 2) return `M${x(0)} ${y(0)}L${x(1)} ${y(1)}`;
	let path = `M${x(0)} ${y(0)}`;
	for (let i = 1; i < count - 1; i++) {
		path += `Q${x(i)} ${y(i)} ${round1((x(i) + x(i + 1)) / 2)} ${round1((y(i) + y(i + 1)) / 2)}`;
	}
	return `${path}L${x(count - 1)} ${y(count - 1)}`;
}

export function arrowParts(pts: readonly [number, number, number, number]): {
	line: string;
	head: string;
} {
	const [x1, y1, x2, y2] = pts;
	const length = Math.hypot(x2 - x1, y2 - y1);
	if (length < 1) return { line: `M${x1} ${y1}L${x2} ${y2}`, head: '' };
	const ux = (x2 - x1) / length;
	const uy = (y2 - y1) / length;
	const size = Math.min(Math.max(length * 0.4, 8), 16);
	const bx = x2 - ux * size;
	const by = y2 - uy * size;
	const wing = size * 0.5;
	const left = `${round1(bx - uy * wing)} ${round1(by + ux * wing)}`;
	const right = `${round1(bx + uy * wing)} ${round1(by - ux * wing)}`;
	return {
		line: `M${x1} ${y1}L${round1(bx)} ${round1(by)}`,
		head: `M${x2} ${y2}L${left}L${right}Z`
	};
}

export function textWidth(text: string): number {
	return text.length * TEXT_WIDTH;
}

export function hitShape(shape: Shape, p: Point, radius: number): boolean {
	if (shape.kind === 'pen') {
		const { pts } = shape;
		if (pts.length < 4) return Math.hypot(p.x - pts[0], p.y - pts[1]) <= radius + STROKE_WIDTH;
		for (let i = 0; i + 3 < pts.length; i += 2) {
			if (
				distanceToSegment(p, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) <=
				radius + STROKE_WIDTH / 2
			) {
				return true;
			}
		}
		return false;
	}
	if (shape.kind === 'arrow') {
		const [x1, y1, x2, y2] = shape.pts;
		return distanceToSegment(p, x1, y1, x2, y2) <= radius + STROKE_WIDTH / 2;
	}
	if (shape.kind === 'robot') {
		const reach = ROBOT_SIZE / 2 + radius / 2;
		return Math.abs(p.x - shape.x) <= reach && Math.abs(p.y - shape.y) <= reach;
	}
	const slack = radius / 2;
	return (
		p.x >= shape.x - slack &&
		p.x <= shape.x + textWidth(shape.text) + slack &&
		p.y >= shape.y - TEXT_SIZE - slack &&
		p.y <= shape.y + 4 + slack
	);
}

export function hitTest(shapes: readonly Shape[], p: Point, radius: number): string | null {
	for (let i = shapes.length - 1; i >= 0; i--) {
		if (hitShape(shapes[i], p, radius)) return shapes[i].id;
	}
	return null;
}

export function hitMovable(shapes: readonly Shape[], p: Point): Shape | null {
	for (let i = shapes.length - 1; i >= 0; i--) {
		const shape = shapes[i];
		if ((shape.kind === 'robot' || shape.kind === 'text') && hitShape(shape, p, 0)) return shape;
	}
	return null;
}

export type BoardOp =
	| { type: 'add'; plan: string; shapes: Shape[] }
	| { type: 'remove'; plan: string; shapes: Shape[] }
	| { type: 'move'; plan: string; id: string; from: Point; to: Point };

export function invertOp(op: BoardOp): BoardOp {
	if (op.type === 'add') return { type: 'remove', plan: op.plan, shapes: op.shapes };
	if (op.type === 'remove') return { type: 'add', plan: op.plan, shapes: op.shapes };
	return { type: 'move', plan: op.plan, id: op.id, from: op.to, to: op.from };
}

function updatePlan(boards: Boards, id: string, now: number, change: (plan: Plan) => Plan): Boards {
	return {
		...boards,
		plans: boards.plans.map((plan) => (plan.id === id ? { ...change(plan), updatedAt: now } : plan))
	};
}

export function applyOp(boards: Boards, op: BoardOp, now: number): Boards {
	return updatePlan(boards, op.plan, now, (plan) => {
		if (op.type === 'add') {
			const present = new Set(plan.shapes.map((shape) => shape.id));
			const added = op.shapes.filter((shape) => !present.has(shape.id));
			return { ...plan, shapes: [...plan.shapes, ...added].slice(0, LIMITS.shapes) };
		}
		if (op.type === 'remove') {
			const gone = new Set(op.shapes.map((shape) => shape.id));
			return { ...plan, shapes: plan.shapes.filter((shape) => !gone.has(shape.id)) };
		}
		return {
			...plan,
			shapes: plan.shapes.map((shape) =>
				shape.id === op.id && (shape.kind === 'robot' || shape.kind === 'text')
					? { ...shape, x: op.to.x, y: op.to.y }
					: shape
			)
		};
	});
}

export interface History {
	undo: BoardOp[];
	redo: BoardOp[];
}

export const EMPTY_HISTORY: History = { undo: [], redo: [] };

export function record(history: History, op: BoardOp): History {
	return { undo: [...history.undo, op].slice(-HISTORY_LIMIT), redo: [] };
}

export function stepBack(history: History): { history: History; op: BoardOp | null } {
	const last = history.undo.at(-1);
	if (!last) return { history, op: null };
	return {
		history: { undo: history.undo.slice(0, -1), redo: [...history.redo, last] },
		op: invertOp(last)
	};
}

export function stepForward(history: History): { history: History; op: BoardOp | null } {
	const last = history.redo.at(-1);
	if (!last) return { history, op: null };
	return {
		history: { undo: [...history.undo, last], redo: history.redo.slice(0, -1) },
		op: last
	};
}

export function blankPlan(id: string, name: string, now: number): Plan {
	return { id, name, notes: '', shapes: [], updatedAt: now };
}

export function defaultPlanName(boards: Boards): string {
	let highest = 0;
	for (const plan of boards.plans) {
		const found = /^Plan (\d+)$/.exec(plan.name);
		if (found) highest = Math.max(highest, Number(found[1]));
	}
	return `Plan ${Math.max(highest, boards.plans.length) + 1}`;
}

export function addPlan(boards: Boards, plan: Plan): Boards {
	if (boards.plans.some((existing) => existing.id === plan.id)) return boards;
	if (boards.plans.length >= LIMITS.plans) return boards;
	return { ...boards, plans: [...boards.plans, plan] };
}

export function upsertPlan(boards: Boards, plan: Plan): Boards {
	const exists = boards.plans.some((existing) => existing.id === plan.id);
	if (exists) {
		return {
			...boards,
			plans: boards.plans.map((existing) => (existing.id === plan.id ? plan : existing))
		};
	}
	return addPlan(boards, plan);
}

export function renamePlan(boards: Boards, id: string, name: string, now: number): Boards {
	return updatePlan(boards, id, now, (plan) => ({ ...plan, name: name.slice(0, 60) }));
}

export function setPlanNotes(boards: Boards, id: string, notes: string, now: number): Boards {
	return updatePlan(boards, id, now, (plan) => ({ ...plan, notes: notes.slice(0, 2000) }));
}

export function removePlan(boards: Boards, id: string): Boards {
	return { ...boards, plans: boards.plans.filter((plan) => plan.id !== id) };
}

export function duplicatePlan(boards: Boards, id: string, copyId: string, now: number): Boards {
	const source = boards.plans.find((plan) => plan.id === id);
	if (!source) return boards;
	return addPlan(boards, {
		...source,
		id: copyId,
		name: `${source.name} copy`.slice(0, 60),
		updatedAt: now
	});
}

export function isFull(plan: Plan): boolean {
	return plan.shapes.length >= LIMITS.shapes;
}
