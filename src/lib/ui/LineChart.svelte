<script lang="ts" module>
	export type LinePoint = { label: string; value: number };
	export type LineDivider = { after: number; label: string };
</script>

<script lang="ts">
	import { fixed, integer } from '#lib/format/number.ts';
	import { labelEvery, linearScale, niceTicks } from './chart.ts';

	interface Props {
		points: LinePoint[];
		label: string;
		height?: number;
		yMin?: number;
		yMax?: number;
		divider?: LineDivider;
		format?: (value: number) => string;
		xName?: string;
		yName?: string;
	}

	let {
		points,
		label,
		height = 200,
		yMin = 0,
		yMax,
		divider,
		format = (value: number) => fixed(value),
		xName = 'Match',
		yName = 'Value'
	}: Props = $props();

	const margin = { top: 24, right: 18, bottom: 28, left: 34 };

	let measured = $state(0);
	let active = $state<number | null>(null);

	const width = $derived(measured > 0 ? measured : 600);
	const values = $derived(points.map((point) => point.value));
	const ticks = $derived(
		niceTicks(Math.min(yMin, ...values), Math.max(yMax ?? Number.NEGATIVE_INFINITY, ...values), 4)
	);
	const plot = $derived({
		left: margin.left,
		right: Math.max(margin.left + 1, width - margin.right),
		top: margin.top,
		bottom: height - margin.bottom
	});
	const y = $derived(linearScale([ticks[0], ticks[ticks.length - 1]], [plot.bottom, plot.top]));
	const center = $derived((plot.left + plot.right) / 2);
	const x = $derived(
		linearScale(
			[0, Math.max(1, points.length - 1)],
			points.length > 1 ? [plot.left, plot.right] : [center, center]
		)
	);
	const coords = $derived(
		points.map((point, index) => ({ ...point, x: x(index), y: y(point.value) }))
	);
	const path = $derived(
		coords
			.map(
				(point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`
			)
			.join(' ')
	);
	const spacing = $derived(
		points.length > 1 ? (plot.right - plot.left) / (points.length - 1) : Number.POSITIVE_INFINITY
	);
	const every = $derived(labelEvery(points.length, spacing));
	const dividerX = $derived(
		divider && divider.after >= 0 && divider.after < points.length - 1
			? (x(divider.after) + x(divider.after + 1)) / 2
			: null
	);
	const hovered = $derived(active === null ? null : (coords[active] ?? null));

	function alignTip(at: number) {
		if (at < 56) return 'start';
		if (at > width - 56) return 'end';
		return 'center';
	}

	function tickLabel(value: number) {
		return Number.isInteger(value) ? integer(value) : fixed(value, 1);
	}

	function track(event: PointerEvent) {
		if (points.length === 0) return;
		const box = (event.currentTarget as Element).getBoundingClientRect();
		const pointer = box.width > 0 ? ((event.clientX - box.left) / box.width) * width : 0;
		const index = Number.isFinite(spacing) ? Math.round((pointer - plot.left) / spacing) : 0;
		active = Math.min(points.length - 1, Math.max(0, index));
	}
</script>

<div class="chart" bind:clientWidth={measured}>
	<svg
		viewBox="0 0 {width} {height}"
		width="100%"
		{height}
		aria-hidden="true"
		onpointermove={track}
		onpointerleave={() => (active = null)}
	>
		{#each ticks as tick (tick)}
			<line class="grid" x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} />
			<text class="tick" x={plot.left - 8} y={y(tick) + 4} text-anchor="end">{tickLabel(tick)}</text
			>
		{/each}
		{#if divider && dividerX !== null}
			<line class="divider" x1={dividerX} x2={dividerX} y1={plot.top} y2={plot.bottom} />
			<text
				class="divider-label"
				x={dividerX + (dividerX > width - 80 ? -6 : 6)}
				y={plot.top - 9}
				text-anchor={dividerX > width - 80 ? 'end' : 'start'}>{divider.label}</text
			>
		{/if}
		{#if hovered}
			<line class="cross" x1={hovered.x} x2={hovered.x} y1={plot.top} y2={plot.bottom} />
		{/if}
		<path class="line" d={path} />
		{#each coords as point, index (index)}
			<circle class={['point', { active: index === active }]} cx={point.x} cy={point.y} r="3.5" />
			{#if (points.length - 1 - index) % every === 0}
				<text class="x-label" x={point.x} y={height - 8} text-anchor="middle">{point.label}</text>
			{/if}
		{/each}
	</svg>

	{#if hovered}
		<div class={['tip', alignTip(hovered.x)]} style:left="{hovered.x}px" style:top="{hovered.y}px">
			<b>{format(hovered.value)}</b>
			<span>{hovered.label}</span>
		</div>
	{/if}

	<table class="visually-hidden">
		<caption>{label}</caption>
		<thead>
			<tr>
				<th scope="col">{xName}</th>
				<th scope="col">{yName}</th>
			</tr>
		</thead>
		<tbody>
			{#each points as point, index (index)}
				<tr>
					<td>{point.label}</td>
					<td>{format(point.value)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.chart {
		position: relative;
		min-width: 0;
	}

	svg {
		display: block;
		overflow: visible;
		touch-action: pan-y;
	}

	.grid {
		stroke: var(--line);
	}

	.line {
		fill: none;
		stroke: var(--text);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.point {
		fill: var(--bg);
		stroke: var(--text);
		stroke-width: 1.5;
	}

	.point.active {
		fill: var(--text);
	}

	text {
		font: 500 11px var(--font);
		fill: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.divider {
		stroke: var(--line-2);
		stroke-dasharray: 3 3;
	}

	.cross {
		stroke: var(--line-2);
	}

	.tip {
		position: absolute;
		display: grid;
		padding: 5px 8px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		font-size: 12px;
		line-height: 1.3;
		white-space: nowrap;
		pointer-events: none;
		transform: translate(-50%, calc(-100% - 10px));
	}

	.tip.start {
		transform: translate(-8px, calc(-100% - 10px));
	}

	.tip.end {
		transform: translate(calc(-100% + 8px), calc(-100% - 10px));
	}

	.tip b {
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.tip span {
		color: var(--text-2);
	}
</style>
