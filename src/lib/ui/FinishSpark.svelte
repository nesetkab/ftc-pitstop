<script lang="ts">
	import { ordinal } from '#lib/format/ordinal.ts';
	import { pct } from '#lib/format/pct.ts';

	interface Props {
		dist: number[];
		width?: number;
		height?: number;
		label?: string;
	}

	let { dist, width = 108, height = 20, label }: Props = $props();

	const peak = $derived(Math.max(0, ...dist));
	const mode = $derived(peak > 0 ? dist.indexOf(peak) : -1);
	const step = $derived(dist.length > 0 ? width / dist.length : 0);
	const bars = $derived(
		dist.flatMap((value, index) => {
			if (!(value > 0) || peak === 0) return [];
			const barHeight = Math.max(1.5, (value / peak) * (height - 2));
			return [
				{
					index,
					x: index * step + 0.5,
					y: height - barHeight,
					width: Math.max(step - 1, 0.5),
					height: barHeight
				}
			];
		})
	);
	const description = $derived(
		label ??
			(mode >= 0 ? `Most likely finish ${ordinal(mode + 1)}, ${pct(peak)}` : 'No finish projection')
	);
</script>

<svg
	class="spark"
	viewBox="0 0 {width} {height}"
	{width}
	{height}
	preserveAspectRatio="none"
	role="img"
	aria-label={description}
>
	{#each bars as bar (bar.index)}
		<rect
			class:mode={bar.index === mode}
			x={bar.x.toFixed(2)}
			y={bar.y.toFixed(2)}
			width={bar.width.toFixed(2)}
			height={bar.height.toFixed(2)}
		/>
	{/each}
</svg>

<style>
	.spark {
		display: block;
		margin-left: auto;
	}

	rect {
		fill: var(--text-3);
	}

	rect.mode {
		fill: var(--text);
	}
</style>
