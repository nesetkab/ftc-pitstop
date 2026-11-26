<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BoxId } from './layout.ts';

	export interface Box {
		id: BoxId;
		label: string;
		content: Snippet;
		/** The content scrolls itself and takes the height that is left. */
		fill?: boolean;
	}
</script>

<script lang="ts">
	import {
		BOXES,
		layoutKey,
		moveRect,
		parseRects,
		sizeRect,
		SNAP,
		snapRects,
		type BoardName,
		type Rects
	} from './layout.ts';

	interface Props {
		name: BoardName;
		boxes: Box[];
		/** CSS grid used until someone moves a box. */
		areas: string;
		columns: string;
		rows: string;
	}

	let { name, boxes, areas, columns, rows }: Props = $props();

	let board: HTMLDivElement;
	// null until someone moves or resizes a box; the built-in grid is used until then.
	let rects = $state.raw<Rects | null>(null);
	let front = $state<BoxId | null>(null);
	let drag = $state.raw<{
		id: BoxId;
		mode: 'move' | 'size';
		x: number;
		y: number;
		from: Rects;
	} | null>(null);

	const storageKey = $derived(layoutKey(name));

	$effect(() => {
		try {
			rects = parseRects(localStorage.getItem(storageKey));
		} catch {
			// Storage can be blocked; the built-in sizes are fine.
			rects = null;
		}
	});

	// "Reset layout" lives in the settings menu at the top.
	$effect(() => {
		const reset = () => {
			rects = null;
			front = null;
		};
		window.addEventListener('pitstop:reset-layout', reset);
		return () => window.removeEventListener('pitstop:reset-layout', reset);
	});

	function save() {
		try {
			if (rects) localStorage.setItem(storageKey, JSON.stringify(rects));
		} catch {
			// Remembering is a convenience only.
		}
	}

	/** Where every box is right now, so moving one leaves the others where they are. */
	function measure(): Rects {
		const area = board.getBoundingClientRect();
		const found: Rects = {};
		for (const id of BOXES) {
			const element = board.querySelector(`[data-box="${id}"]`);
			if (rects?.[id]) found[id] = rects[id];
			else if (element) {
				const box = element.getBoundingClientRect();
				found[id] = {
					x: ((box.left - area.left) / area.width) * 100,
					y: ((box.top - area.top) / area.height) * 100,
					w: (box.width / area.width) * 100,
					h: (box.height / area.height) * 100
				};
			}
		}
		return snapRects(found);
	}

	function change(from: Rects, id: BoxId, mode: 'move' | 'size', dx: number, dy: number) {
		const rect = from[id];
		if (!rect) return;
		rects = { ...from, [id]: (mode === 'move' ? moveRect : sizeRect)(rect, dx, dy) };
	}

	function start(event: PointerEvent, id: BoxId, mode: 'move' | 'size') {
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		front = id;
		drag = { id, mode, x: event.clientX, y: event.clientY, from: measure() };
	}

	function move(event: PointerEvent) {
		if (!drag) return;
		const area = board.getBoundingClientRect();
		const dx = ((event.clientX - drag.x) / area.width) * 100;
		const dy = ((event.clientY - drag.y) / area.height) * 100;
		change(drag.from, drag.id, drag.mode, dx, dy);
	}

	function end() {
		if (!drag) return;
		drag = null;
		save();
	}

	function key(event: KeyboardEvent, id: BoxId, mode: 'move' | 'size') {
		const steps: Record<string, [number, number]> = {
			ArrowLeft: [-SNAP, 0],
			ArrowRight: [SNAP, 0],
			ArrowUp: [0, -SNAP],
			ArrowDown: [0, SNAP]
		};
		const step = steps[event.key];
		if (!step) return;
		event.preventDefault();
		front = id;
		change(measure(), id, mode, ...step);
		save();
	}

	function place(id: BoxId): string {
		const rect = rects?.[id];
		const area = `grid-area:${id}`;
		return rect ? `${area};--x:${rect.x}%;--y:${rect.y}%;--w:${rect.w}%;--h:${rect.h}%` : area;
	}
</script>

<!-- On a wide screen every box can be moved and resized on its own. -->
<div
	class={['board', { free: rects !== null, dragging: drag !== null }]}
	bind:this={board}
	style:--areas={areas}
	style:--columns={columns}
	style:--rows={rows}
>
	{#each boxes as box (box.id)}
		<section
			class={['cell', box.id, { front: front === box.id }]}
			data-box={box.id}
			style={place(box.id)}
		>
			<div class={['body', { fill: box.fill }]}>{@render box.content()}</div>
			{#each ['move', 'size'] as const as mode (mode)}
				<button
					type="button"
					class={['handle', mode]}
					aria-label="{mode === 'move' ? 'Move' : 'Resize'} {box.label}"
					onpointerdown={(event) => start(event, box.id, mode)}
					onpointermove={move}
					onpointerup={end}
					onpointercancel={end}
					onkeydown={(event) => key(event, box.id, mode)}
				></button>
			{/each}
		</section>
	{/each}
</div>

<style>
	.board {
		position: relative;
		display: grid;
		grid-template-areas: var(--areas);
		grid-template-columns: var(--columns);
		grid-template-rows: var(--rows);
		height: 100%;
		min-height: 0;
	}

	.cell {
		position: relative;
		display: grid;
		grid-template: minmax(0, 1fr) / minmax(0, 1fr);
		min-width: 0;
		min-height: 0;
		background: var(--bg);
		box-shadow:
			inset -1px 0 var(--line),
			inset 0 -1px var(--line);
	}

	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: 0.9em;
		min-width: 0;
		min-height: 0;
		padding: 1.3em 1.4em;
		overflow: hidden auto;
	}

	.body.fill {
		grid-template-rows: auto minmax(0, 1fr);
		align-content: stretch;
	}

	/* Room at the sides so the move and resize handles don't cover the link box. */
	.stream .body {
		grid-template-rows: minmax(0, 1fr);
		padding: 0.8em 2.4em;
	}

	/* Smaller text beside the stream so the queue time still fits. */
	[data-box='stream'] ~ .next {
		font-size: 0.82em;
	}

	.handle {
		position: absolute;
		z-index: 3;
		width: 1.8em;
		height: 1.8em;
		padding: 0;
		border: 1px solid var(--line-2);
		border-radius: 0.3em;
		background: var(--bg);
		color: var(--text);
		font: inherit;
		touch-action: none;
		opacity: 0;
	}

	.handle.move {
		top: 0.2em;
		right: 0.2em;
		cursor: move;
	}

	.handle.move::before {
		content: '✥';
	}

	.handle.size {
		right: 0.2em;
		bottom: 0.2em;
		cursor: nwse-resize;
	}

	.handle.size::before {
		content: '⤡';
	}

	[data-box]:hover > .handle,
	.handle:focus-visible {
		opacity: 1;
	}

	@media (orientation: landscape) {
		/* Not a grid any more, so each box is placed against the whole board. */
		.board.free {
			display: block;
		}

		.board.free [data-box] {
			position: absolute;
			left: var(--x);
			top: var(--y);
			width: var(--w);
			height: var(--h);
			z-index: 1;
			box-shadow: 0 0 0 1px var(--line);
		}

		.board.free [data-box].front {
			z-index: 2;
		}
	}

	/* Stops the video frame from swallowing the drag. */
	.board.dragging :global(iframe) {
		pointer-events: none;
	}

	@media (orientation: portrait) {
		.board {
			display: flex;
			flex-direction: column;
			overflow-y: auto;
		}

		.cell {
			flex: none;
			height: 40vh;
		}

		.handle {
			display: none;
		}
	}
</style>
