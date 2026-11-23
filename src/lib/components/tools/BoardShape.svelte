<svelte:options namespace="svg" />

<script lang="ts">
	import {
		arrowParts,
		ROBOT_SIZE,
		smoothPath,
		STROKE_WIDTH,
		TEXT_SIZE
	} from '#lib/workspace/board.ts';
	import type { Shape } from '#lib/workspace/schemas.ts';

	interface Props {
		shape: Shape;
		preview?: boolean;
	}

	let { shape, preview = false }: Props = $props();

	const half = ROBOT_SIZE / 2;
</script>

{#if shape.kind === 'pen'}
	<path
		class={['mark', shape.color, { dash: shape.dash, preview }]}
		d={smoothPath(shape.pts)}
		stroke-width={STROKE_WIDTH}
	/>
{:else if shape.kind === 'arrow'}
	{@const parts = arrowParts(shape.pts)}
	<g class={['mark', shape.color, { preview }]}>
		<path class={{ dash: shape.dash }} d={parts.line} stroke-width={STROKE_WIDTH} />
		{#if parts.head}
			<path class="head" d={parts.head} stroke-width="1" />
		{/if}
	</g>
{:else if shape.kind === 'robot'}
	<g class={['robot', shape.color, { preview }]}>
		<rect x={shape.x - half} y={shape.y - half} width={ROBOT_SIZE} height={ROBOT_SIZE} rx="4" />
		{#if shape.label}
			<text x={shape.x} y={shape.y + half + 15} text-anchor="middle">{shape.label}</text>
		{/if}
	</g>
{:else}
	<text class={['note', shape.color, { preview }]} x={shape.x} y={shape.y} font-size={TEXT_SIZE}
		>{shape.text}</text
	>
{/if}

<style>
	.ink {
		color: var(--text);
	}

	.red {
		color: var(--red);
	}

	.blue {
		color: var(--blue);
	}

	.green {
		color: var(--ok);
	}

	.mark path {
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	path.mark {
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.mark .head {
		fill: currentColor;
	}

	.dash {
		stroke-dasharray: 2 7;
	}

	.robot rect {
		fill: currentColor;
	}

	.robot text,
	.note {
		paint-order: stroke;
		stroke: var(--surface);
		stroke-linejoin: round;
		stroke-width: 3px;
		font-family: var(--font);
		font-weight: 600;
	}

	.robot text {
		fill: var(--text);
		font-size: 13px;
	}

	.note {
		fill: currentColor;
	}

	.preview {
		opacity: 0.85;
	}
</style>
