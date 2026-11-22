<script lang="ts">
	import '#lib/components/tools/controls.css';
	import BoardShape from '#lib/components/tools/BoardShape.svelte';
	import { exportPng } from '#lib/components/tools/export-png.ts';
	import Field from '#lib/components/tools/Field.svelte';
	import ShareLink from '#lib/components/tools/ShareLink.svelte';
	import Button from '#lib/ui/Button.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import {
		addPlan,
		applyOp,
		blankPlan,
		clientToField,
		defaultPlanName,
		duplicatePlan,
		EMPTY_HISTORY,
		hitMovable,
		hitTest,
		record,
		removePlan,
		renamePlan,
		setPlanNotes,
		simplify,
		stepBack,
		stepForward,
		thin,
		type BoardOp,
		type History,
		type Point
	} from '#lib/workspace/board.ts';
	import { newId } from '#lib/workspace/code.ts';
	import {
		LIMITS,
		SHAPE_COLORS,
		type Boards,
		type Plan,
		type RobotShape,
		type Shape,
		type ShapeColor,
		type TextShape
	} from '#lib/workspace/schemas.ts';
	import { sharePayload } from '#lib/workspace/share.ts';

	interface Props {
		boards: Boards;
		team?: number | null;
		update?: (change: (boards: Boards) => Boards) => void;
		shareContext?: { from: string | null; team: number | null };
	}

	let { boards, team = null, update, shareContext }: Props = $props();

	type Tool = 'pen' | 'arrow' | 'robot' | 'text' | 'erase';

	type Gesture =
		| { kind: 'pen'; pts: number[] }
		| { kind: 'arrow'; from: Point; to: Point }
		| { kind: 'place'; shape: RobotShape }
		| { kind: 'move'; shape: RobotShape | TextShape; grab: Point; to: Point }
		| { kind: 'text'; at: Point }
		| { kind: 'erase'; hit: Shape[] };

	const TOOLS: { id: Tool; label: string; key: string }[] = [
		{ id: 'pen', label: 'Pen', key: 'p' },
		{ id: 'arrow', label: 'Arrow', key: 'a' },
		{ id: 'robot', label: 'Robot', key: 'r' },
		{ id: 'text', label: 'Text', key: 't' },
		{ id: 'erase', label: 'Erase', key: 'e' }
	];

	const COLOR_NAMES: Record<ShapeColor, string> = {
		ink: 'Black',
		red: 'Red',
		blue: 'Blue',
		accent: 'Yellow'
	};

	const ERASE_RADIUS = 7;
	const MAX_LIVE_VALUES = 1600;

	const id = $props.id();
	let root = $state<HTMLElement>();
	let svg = $state<SVGSVGElement>();
	let activeId = $state<string | null>(null);
	let tool = $state<Tool>('pen');
	let color = $state<ShapeColor>('ink');
	let dash = $state(false);
	let robotNumber = $state('');
	let history = $state.raw<History>(EMPTY_HISTORY);
	let gesture = $state.raw<Gesture | null>(null);
	let editing = $state<{ x: number; y: number; value: string } | null>(null);
	let confirmDelete = $state(false);
	let exportError = $state('');

	const editable = $derived(update !== undefined);
	const plan = $derived(
		boards.plans.find((item) => item.id === activeId) ?? boards.plans[0] ?? null
	);
	const shapes = $derived(plan?.shapes ?? []);
	const full = $derived(shapes.length >= LIMITS.shapes);
	const hidden = $derived.by(() => {
		if (gesture?.kind === 'erase') return new Set(gesture.hit.map((shape) => shape.id));
		if (gesture?.kind === 'move') return new Set([gesture.shape.id]);
		return new Set<string>();
	});
	const visible = $derived(shapes.filter((shape) => !hidden.has(shape.id)));
	const robotLabel = $derived(robotNumber.trim() || (team ? String(team) : ''));

	const preview = $derived.by((): Shape | null => {
		if (!gesture) return null;
		if (gesture.kind === 'pen') {
			return { id: 'preview', kind: 'pen', color, dash, pts: gesture.pts };
		}
		if (gesture.kind === 'arrow') {
			const { from, to } = gesture;
			return { id: 'preview', kind: 'arrow', color, dash, pts: [from.x, from.y, to.x, to.y] };
		}
		if (gesture.kind === 'place') return gesture.shape;
		if (gesture.kind === 'move') return { ...gesture.shape, x: gesture.to.x, y: gesture.to.y };
		return null;
	});

	function pointOf(event: { clientX: number; clientY: number }): Point {
		const box = svg?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 };
		return clientToField(box, event.clientX, event.clientY);
	}

	function target(): { id: string; created: Plan | null } {
		if (plan) return { id: plan.id, created: null };
		const created = blankPlan(newId(), defaultPlanName(boards), Date.now());
		return { id: created.id, created };
	}

	function commit(build: (planId: string) => BoardOp) {
		const { id: planId, created } = target();
		const op = build(planId);
		const stamp = Date.now();
		if (created) activeId = created.id;
		update?.((current) => applyOp(created ? addPlan(current, created) : current, op, stamp));
		history = record(history, op);
	}

	function edit(change: (current: Boards, planId: string, stamp: number) => Boards) {
		const { id: planId, created } = target();
		const stamp = Date.now();
		if (created) activeId = created.id;
		update?.((current) => change(created ? addPlan(current, created) : current, planId, stamp));
	}

	function addShape(shape: Shape) {
		if (full) return;
		commit((planId) => ({ type: 'add', plan: planId, shapes: [shape] }));
	}

	function down(event: PointerEvent) {
		if (!editable || (event.pointerType === 'mouse' && event.button !== 0)) return;
		if (editing) commitText();
		const point = pointOf(event);
		svg?.setPointerCapture?.(event.pointerId);
		const grabbed = tool === 'robot' || tool === 'text' ? hitMovable(visible, point) : null;
		if (grabbed && (grabbed.kind === 'robot' || grabbed.kind === 'text')) {
			gesture = {
				kind: 'move',
				shape: grabbed,
				grab: { x: point.x - grabbed.x, y: point.y - grabbed.y },
				to: { x: grabbed.x, y: grabbed.y }
			};
		} else if (tool === 'pen') {
			gesture = { kind: 'pen', pts: [point.x, point.y] };
		} else if (tool === 'arrow') {
			gesture = { kind: 'arrow', from: point, to: point };
		} else if (tool === 'robot') {
			gesture = {
				kind: 'place',
				shape: {
					id: newId(),
					kind: 'robot',
					color,
					x: point.x,
					y: point.y,
					label: robotLabel.slice(0, 8)
				}
			};
		} else if (tool === 'text') {
			gesture = { kind: 'text', at: point };
		} else {
			gesture = { kind: 'erase', hit: eraseAt(point, []) };
		}
	}

	function eraseAt(point: Point, already: Shape[]): Shape[] {
		const found = hitTest(
			visible.filter((shape) => !already.some((item) => item.id === shape.id)),
			point,
			ERASE_RADIUS
		);
		const shape = visible.find((item) => item.id === found);
		return shape ? [...already, shape] : already;
	}

	function move(event: PointerEvent) {
		if (!gesture) return;
		const batch = event.getCoalescedEvents?.() ?? [];
		const samples = batch.length > 0 ? batch : [event];
		const current = gesture;
		if (current.kind === 'pen') {
			let pts = current.pts;
			for (const sample of samples) {
				const point = pointOf(sample);
				const last = pts.length - 2;
				const far = Math.hypot(point.x - pts[last], point.y - pts[last + 1]) >= 1.2;
				if (far && pts.length < MAX_LIVE_VALUES) pts = [...pts, point.x, point.y];
			}
			if (pts !== current.pts) gesture = { kind: 'pen', pts };
		} else if (current.kind === 'arrow') {
			gesture = { kind: 'arrow', from: current.from, to: pointOf(event) };
		} else if (current.kind === 'place') {
			const point = pointOf(event);
			gesture = { kind: 'place', shape: { ...current.shape, x: point.x, y: point.y } };
		} else if (current.kind === 'move') {
			const point = pointOf(event);
			gesture = {
				...current,
				to: { x: point.x - current.grab.x, y: point.y - current.grab.y }
			};
		} else if (current.kind === 'erase') {
			let hit = current.hit;
			for (const sample of samples) hit = eraseAt(pointOf(sample), hit);
			if (hit !== current.hit) gesture = { kind: 'erase', hit };
		}
	}

	function finishPen(values: number[]) {
		let epsilon = 0.8;
		let pts = simplify(thin(values, 1.2), epsilon);
		while (pts.length > LIMITS.penValues && epsilon < 50) {
			epsilon *= 2;
			pts = simplify(pts, epsilon);
		}
		if (pts.length < 2) return;
		const shape: Shape = { id: newId(), kind: 'pen', color, dash, pts };
		addShape(shape);
	}

	function up(event: PointerEvent) {
		const current = gesture;
		gesture = null;
		if (!current) return;
		if (current.kind === 'pen') {
			finishPen(current.pts);
		} else if (current.kind === 'arrow') {
			const { from } = current;
			const to = pointOf(event);
			if (Math.hypot(to.x - from.x, to.y - from.y) >= 6) {
				addShape({ id: newId(), kind: 'arrow', color, dash, pts: [from.x, from.y, to.x, to.y] });
			}
		} else if (current.kind === 'place') {
			addShape(current.shape);
		} else if (current.kind === 'move') {
			const from = { x: current.shape.x, y: current.shape.y };
			if (Math.hypot(current.to.x - from.x, current.to.y - from.y) >= 1) {
				const shapeId = current.shape.id;
				const to = current.to;
				commit((planId) => ({ type: 'move', plan: planId, id: shapeId, from, to }));
			}
		} else if (current.kind === 'text') {
			editing = { x: current.at.x, y: current.at.y, value: '' };
		} else if (current.kind === 'erase' && current.hit.length > 0) {
			const removed = current.hit;
			commit((planId) => ({ type: 'remove', plan: planId, shapes: removed }));
		}
	}

	function commitText() {
		if (!editing) return;
		const { x, y } = editing;
		const text = editing.value.trim().slice(0, 60);
		editing = null;
		if (text) addShape({ id: newId(), kind: 'text', color, x, y, text });
	}

	function textKey(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitText();
		} else if (event.key === 'Escape') {
			editing = null;
		}
	}

	function focusNode(node: HTMLInputElement) {
		node.focus();
	}

	function undo() {
		const step = stepBack(history);
		if (!step.op) return;
		history = step.history;
		const op = step.op;
		const stamp = Date.now();
		update?.((current) => applyOp(current, op, stamp));
	}

	function redo() {
		const step = stepForward(history);
		if (!step.op) return;
		history = step.history;
		const op = step.op;
		const stamp = Date.now();
		update?.((current) => applyOp(current, op, stamp));
	}

	function clear() {
		const removed = [...shapes];
		if (removed.length === 0) return;
		commit((planId) => ({ type: 'remove', plan: planId, shapes: removed }));
	}

	function shortcuts(event: KeyboardEvent) {
		const element = event.target as HTMLElement | null;
		if (!editable || !root || !element || !root.contains(element)) return;
		if (element.closest('input, textarea, select')) return;
		const modifier = event.metaKey || event.ctrlKey;
		const key = event.key.toLowerCase();
		if (modifier && key === 'z') {
			event.preventDefault();
			if (event.shiftKey) redo();
			else undo();
		} else if (modifier && key === 'y') {
			event.preventDefault();
			redo();
		} else if (!modifier && !event.altKey) {
			const match = TOOLS.find((item) => item.key === key);
			if (match) tool = match.id;
		}
	}

	function choose(planId: string) {
		activeId = planId;
		history = EMPTY_HISTORY;
		confirmDelete = false;
	}

	function newPlan() {
		const fresh = blankPlan(newId(), defaultPlanName(boards), Date.now());
		update?.((current) => addPlan(current, fresh));
		choose(fresh.id);
	}

	function copyPlan() {
		if (!plan) return;
		const source = plan.id;
		const copy = newId();
		const stamp = Date.now();
		update?.((current) => duplicatePlan(current, source, copy, stamp));
		choose(copy);
	}

	function deletePlan() {
		if (!plan) return;
		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}
		const doomed = plan.id;
		update?.((current) => removePlan(current, doomed));
		activeId = null;
		history = EMPTY_HISTORY;
		confirmDelete = false;
	}

	async function download() {
		exportError = '';
		if (!svg) return;
		try {
			await exportPng(svg, plan?.name ?? 'plan');
		} catch {
			exportError = 'The plan could not be saved as an image.';
		}
	}
</script>

<svelte:window onkeydown={shortcuts} />

<section class="board" aria-label="Strategy board" bind:this={root}>
	<div class="sb" class:readonly={!editable}>
		{#if editable}
			<div class="rail" role="toolbar" aria-label="Drawing tools">
				{#each TOOLS as item (item.id)}
					<button
						type="button"
						class="tool"
						aria-pressed={tool === item.id}
						aria-keyshortcuts={item.key.toUpperCase()}
						onclick={() => (tool = item.id)}
					>
						{item.label}
					</button>
				{/each}
				<span class="rule" aria-hidden="true"></span>
				<button type="button" class="tool" disabled={history.undo.length === 0} onclick={undo}>
					Undo
				</button>
				<button type="button" class="tool" disabled={history.redo.length === 0} onclick={redo}>
					Redo
				</button>
				<button type="button" class="tool" disabled={shapes.length === 0} onclick={clear}>
					Clear
				</button>
				<span class="rule" aria-hidden="true"></span>
				<button type="button" class="tool" aria-pressed={dash} onclick={() => (dash = !dash)}>
					Dashed
				</button>
				<div class="swatches" role="group" aria-label="Color">
					{#each SHAPE_COLORS as option (option)}
						<button
							type="button"
							class={['swatch', option]}
							aria-label={COLOR_NAMES[option]}
							aria-pressed={color === option}
							onclick={() => (color = option)}
						></button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="canvas">
			<div class="stage">
				<svg
					bind:this={svg}
					class={['surface', tool, { drawing: editable }]}
					viewBox="0 0 480 480"
					role="img"
					aria-label="Simplified BIOBUZZ field{plan ? `, ${plan.name}` : ''}"
					onpointerdown={editable ? down : undefined}
					onpointermove={editable ? move : undefined}
					onpointerup={editable ? up : undefined}
					onpointercancel={editable ? () => (gesture = null) : undefined}
				>
					<Field />
					{#each visible as shape (shape.id)}
						<BoardShape {shape} />
					{/each}
					{#if preview}
						<BoardShape shape={preview} preview />
					{/if}
				</svg>
				{#if editing}
					<input
						class="ctl-input entry"
						style:left="{(editing.x / 480) * 100}%"
						style:top="{((editing.y - 22) / 480) * 100}%"
						aria-label="Text on the field"
						placeholder="Type, then press Enter"
						maxlength="60"
						bind:value={editing.value}
						onkeydown={textKey}
						onblur={commitText}
						use:focusNode
					/>
				{/if}
			</div>
			<p class="note">Simplified field</p>
			{#if full && editable}
				<p class="ctl-error" role="alert">This plan is full. Erase some marks to add more.</p>
			{/if}
		</div>

		<div class="side">
			{#if editable}
				<div class="panel">
					<label class="sec-title" for="{id}-name">Plan name</label>
					<input
						id="{id}-name"
						class="ctl-input"
						maxlength="60"
						placeholder={defaultPlanName(boards)}
						value={plan?.name ?? ''}
						oninput={(event) => {
							const value = event.currentTarget.value;
							edit((current, planId, stamp) => renamePlan(current, planId, value, stamp));
						}}
					/>
					{#if plan}
						<p class="muted line">
							<StaleNotice updated={plan.updatedAt} prefix="Edited" staleAfter={Infinity} />
						</p>
					{/if}
					<div class="ctl-row">
						{#if plan && shareContext}
							<ShareLink
								build={() => sharePayload('board', plan, shareContext)}
								label="Copy share link"
							/>
						{/if}
						<button type="button" class="ctl-btn" onclick={download}>Export PNG</button>
					</div>
					{#if exportError}
						<p class="ctl-error" role="alert">{exportError}</p>
					{/if}
				</div>
				<div class="panel">
					<label class="sec-title" for="{id}-robot">Robot marker</label>
					<input
						id="{id}-robot"
						class="ctl-input"
						inputmode="numeric"
						maxlength="6"
						placeholder={team ? String(team) : 'Team number'}
						value={robotNumber}
						oninput={(event) => {
							robotNumber = event.currentTarget.value.replace(/\D/g, '').slice(0, 6);
							event.currentTarget.value = robotNumber;
						}}
					/>
					<p class="note">The Robot tool places this number. Drag a marker to move it.</p>
				</div>
				<div class="panel">
					<label class="sec-title" for="{id}-notes">Notes</label>
					<textarea
						id="{id}-notes"
						class="ctl-textarea"
						maxlength="2000"
						placeholder="Who does what"
						value={plan?.notes ?? ''}
						oninput={(event) => {
							const value = event.currentTarget.value;
							edit((current, planId, stamp) => setPlanNotes(current, planId, value, stamp));
						}}></textarea>
				</div>
			{:else if plan}
				<div class="panel">
					<h3 class="sec-title">{plan.name}</h3>
					{#if plan.notes}
						<p class="muted notes">{plan.notes}</p>
					{/if}
				</div>
			{/if}

			{#if boards.plans.length > 0}
				<div class="panel">
					<span class="sec-title">Saved plans</span>
					<ul class="plans">
						{#each boards.plans as item (item.id)}
							<li>
								<button
									type="button"
									class="plan"
									aria-current={item.id === plan?.id ? 'true' : undefined}
									onclick={() => choose(item.id)}
								>
									<span class="plan-name">{item.name}</span>
									<StaleNotice updated={item.updatedAt} prefix="" staleAfter={Infinity} />
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if editable}
				<div class="ctl-row">
					<Button variant="secondary" onclick={newPlan}>New plan</Button>
					<button type="button" class="ctl-btn" disabled={!plan} onclick={copyPlan}
						>Duplicate</button
					>
					<button type="button" class="ctl-btn plain" disabled={!plan} onclick={deletePlan}>
						{confirmDelete ? 'Confirm delete' : 'Delete'}
					</button>
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.board {
		min-width: 0;
	}

	.sb {
		display: grid;
		grid-template-columns: 56px minmax(0, 1fr) 260px;
		min-height: 520px;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		overflow: hidden;
	}

	.sb.readonly {
		grid-template-columns: minmax(0, 1fr) 260px;
	}

	.sb > * {
		min-width: 0;
	}

	.rail {
		display: grid;
		align-content: start;
		gap: 4px;
		padding: 12px 6px;
		border-right: 1px solid var(--line);
	}

	.tool {
		display: grid;
		place-items: center;
		height: 34px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--text-2);
		font: 500 11.5px/1 var(--font);
	}

	.tool:hover:enabled {
		color: var(--text);
		background: var(--surface);
	}

	.tool[aria-pressed='true'] {
		background: var(--surface);
		color: var(--text);
		font-weight: 600;
	}

	.tool:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.rule {
		height: 1px;
		margin: 4px 6px;
		background: var(--line);
	}

	.swatches {
		display: grid;
		justify-items: center;
		gap: 8px;
		padding-top: 8px;
	}

	.swatch {
		width: 20px;
		height: 20px;
		padding: 0;
		border: 2px solid var(--bg);
		border-radius: 50%;
		box-shadow: 0 0 0 1px var(--line-2);
		background: currentColor;
	}

	.swatch[aria-pressed='true'] {
		box-shadow: 0 0 0 2px var(--text);
	}

	.swatch.ink {
		color: var(--text);
	}

	.swatch.red {
		color: var(--red);
	}

	.swatch.blue {
		color: var(--blue);
	}

	.swatch.accent {
		color: var(--accent);
	}

	.canvas {
		display: grid;
		gap: 8px;
		align-content: start;
		justify-items: center;
		padding: 18px;
		background: var(--surface);
	}

	.stage {
		position: relative;
		container-type: inline-size;
		width: 100%;
		max-width: 640px;
		aspect-ratio: 1 / 1;
		background: var(--surface);
	}

	svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	svg.drawing {
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	svg.drawing.pen,
	svg.drawing.arrow {
		cursor: crosshair;
	}

	svg.drawing.robot,
	svg.drawing.text {
		cursor: copy;
	}

	svg.drawing.erase {
		cursor: cell;
	}

	.entry {
		position: absolute;
		width: min(200px, 60%);
		padding: 4px 8px;
		font-size: 13px;
	}

	.canvas > .note,
	.canvas > .ctl-error {
		justify-self: start;
		width: 100%;
		max-width: 640px;
	}

	.side {
		display: grid;
		gap: 16px;
		align-content: start;
		padding: 16px;
		border-left: 1px solid var(--line);
	}

	.panel {
		display: grid;
		gap: 8px;
		align-content: start;
		min-width: 0;
	}

	.line {
		font-size: 14px;
	}

	.notes {
		font-size: 14px;
		white-space: pre-wrap;
	}

	.plans {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.plan {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		padding: 8px 0;
		border: 0;
		border-bottom: 1px solid var(--line);
		background: transparent;
		color: var(--text-2);
		font: 400 14px/1.4 var(--font);
		text-align: left;
	}

	.plan:hover {
		color: var(--text);
	}

	.plan[aria-current='true'] {
		color: var(--text);
		font-weight: 600;
	}

	.plan-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.plan :global(time) {
		color: var(--text-3);
		font-size: 12.5px;
		font-weight: 400;
	}

	@media (max-width: 1060px) {
		.sb,
		.sb.readonly {
			grid-template-columns: 56px minmax(0, 1fr);
		}

		.sb.readonly {
			grid-template-columns: minmax(0, 1fr);
		}

		.side {
			grid-column: 1 / -1;
			border-top: 1px solid var(--line);
			border-left: 0;
		}
	}

	@media (max-width: 760px) {
		.sb {
			grid-template-columns: minmax(0, 1fr);
		}

		.rail {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 2px;
			padding: 8px;
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}

		.tool {
			flex: none;
			min-width: 52px;
			height: 36px;
			padding: 0 8px;
		}

		.rule {
			flex-basis: 100%;
			width: auto;
			height: 0;
			margin: 2px 0;
		}

		.swatches {
			display: flex;
			flex: none;
			gap: 10px;
			padding: 0 8px;
		}

		.canvas {
			padding: 12px;
		}
	}

	@media (pointer: coarse) {
		.swatch {
			width: 30px;
			height: 30px;
		}
	}
</style>
