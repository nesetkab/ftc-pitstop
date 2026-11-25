<script lang="ts">
	import { fixed } from '#lib/format/index.ts';
	import { linearScale } from '#lib/ui/chart.ts';
	import type { ChartPoint } from './team-view.ts';

	interface Props {
		points: ChartPoint[];
		width?: number;
		height?: number;
	}

	let { points, width = 96, height = 28 }: Props = $props();

	const pad = 3;
	const values = $derived(points.map((point) => point.value));
	const x = $derived(linearScale([0, Math.max(points.length - 1, 1)], [pad, width - pad]));
	const y = $derived(
		linearScale([Math.min(0, ...values), Math.max(1, ...values)], [height - pad, pad])
	);
	const coords = $derived(points.map((point, index) => [x(index), y(point.value)] as const));
	const line = $derived(coords.map(([cx, cy]) => `${cx.toFixed(1)},${cy.toFixed(1)}`).join(' '));
	const label = $derived(
		`aOPR at each event: ${points.map((point) => `${point.label} ${fixed(point.value)}`).join(', ')}`
	);
</script>

<svg viewBox="0 0 {width} {height}" {width} {height} role="img" aria-label={label}>
	<polyline points={line} />
	{#each coords as [cx, cy], index (index)}
		<circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={index === coords.length - 1 ? 3.5 : 1.5}>
			<title>{points[index].label}: {fixed(points[index].value)}</title>
		</circle>
	{/each}
</svg>

<style>
	svg {
		display: block;
		overflow: visible;
	}

	polyline {
		fill: none;
		stroke: var(--text);
		stroke-width: 1.6;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	circle {
		fill: var(--text-2);
	}

	circle:last-of-type {
		fill: var(--accent);
	}
</style>
