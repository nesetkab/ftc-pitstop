<script lang="ts" module>
	import type { CalibrationBin } from './accuracy.ts';

	export type CalibrationSeries = { label: string; bins: CalibrationBin[] };
</script>

<script lang="ts">
	import { fixed, integer } from '#lib/format/index.ts';

	interface Props {
		series: CalibrationSeries[];
		label: string;
		xTitle?: string;
		yTitle?: string;
		table?: boolean;
	}

	let {
		series,
		label,
		xTitle = 'Predicted chance of winning',
		yTitle = 'Share of matches won',
		table = true
	}: Props = $props();

	const side = 300;
	const margin = { top: 12, right: 14, bottom: 44, left: 48 };
	const width = margin.left + side + margin.right;
	const height = margin.top + side + margin.bottom;
	const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1];

	const x = (value: number) => margin.left + value * side;
	const y = (value: number) => margin.top + (1 - value) * side;
	const percent = (value: number) => `${Math.round(value * 100)}%`;

	const biggest = $derived(
		Math.max(1, ...series.flatMap((entry) => entry.bins.map((bin) => bin.n)))
	);
	const lines = $derived(
		series.map((entry, index) => {
			const points = entry.bins
				.filter((bin) => bin.n > 0)
				.sort((a, b) => a.predicted - b.predicted)
				.map((bin) => ({
					cx: x(bin.predicted),
					cy: y(bin.observed),
					r: 2.5 + 3.5 * Math.sqrt(bin.n / biggest)
				}));
			return {
				label: entry.label,
				style: series.length === 1 ? 1 : index,
				points,
				path: points
					.map(
						(point, at) => `${at === 0 ? 'M' : 'L'}${point.cx.toFixed(1)},${point.cy.toFixed(1)}`
					)
					.join(' ')
			};
		})
	);
</script>

<div class="calibration">
	<svg viewBox="0 0 {width} {height}" role="img" aria-label={label}>
		{#each ticks as tick (tick)}
			<line class="grid" x1={x(0)} x2={x(1)} y1={y(tick)} y2={y(tick)} />
			<line class="grid" x1={x(tick)} x2={x(tick)} y1={y(0)} y2={y(1)} />
			<text class="tick" x={x(0) - 8} y={y(tick) + 4} text-anchor="end">{percent(tick)}</text>
			<text class="tick" x={x(tick)} y={y(0) + 18} text-anchor="middle">{percent(tick)}</text>
		{/each}
		<line class="reference" x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} />
		{#each lines as line (line.label)}
			<path class="line s{line.style}" d={line.path} />
			{#each line.points as point, index (index)}
				<circle class="point s{line.style}" cx={point.cx} cy={point.cy} r={point.r} />
			{/each}
		{/each}
		<text class="axis" x={x(0.5)} y={height - 6} text-anchor="middle">{xTitle}</text>
		<text class="axis" transform="rotate(-90)" x={-y(0.5)} y="13" text-anchor="middle"
			>{yTitle}</text
		>
	</svg>

	<ul class="legend">
		{#each lines as line (line.label)}
			<li><span class="swatch s{line.style}" aria-hidden="true"></span>{line.label}</li>
		{/each}
		<li><span class="swatch reference" aria-hidden="true"></span>Predicted equals actual</li>
	</ul>

	{#if table}
		<table class="visually-hidden">
			<caption>{label}</caption>
			<thead>
				<tr>
					<th scope="col">Series</th>
					<th scope="col">Predicted</th>
					<th scope="col">Actual</th>
					<th scope="col">Matches</th>
				</tr>
			</thead>
			<tbody>
				{#each series as entry (entry.label)}
					{#each entry.bins as bin, index (index)}
						<tr>
							<td>{entry.label}</td>
							<td>{fixed(bin.predicted * 100, 1)}%</td>
							<td>{fixed(bin.observed * 100, 1)}%</td>
							<td>{integer(bin.n)}</td>
						</tr>
					{/each}
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.calibration {
		display: grid;
		gap: 8px;
		min-width: 0;
	}

	svg {
		width: 100%;
		height: auto;
		max-width: 440px;
	}

	.grid {
		stroke: var(--line);
	}

	.reference {
		stroke: var(--text-3);
		stroke-dasharray: 4 4;
	}

	.line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
	}

	.line.s0 {
		stroke: var(--text-3);
	}

	.line.s1 {
		stroke: var(--text);
	}

	.point.s0 {
		fill: var(--text-3);
		stroke: var(--text-3);
	}

	.point.s1 {
		fill: var(--bg);
		stroke: var(--text);
		stroke-width: 1.75;
	}

	text {
		font: 500 11px var(--font);
		fill: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	text.axis {
		fill: var(--text-2);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 13px;
		color: var(--text-2);
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		box-sizing: border-box;
	}

	.swatch.s0 {
		background: var(--text-3);
		border: 1.5px solid var(--text-3);
	}

	.swatch.s1 {
		background: var(--bg);
		border: 1.75px solid var(--text);
	}

	.swatch.reference {
		width: 16px;
		height: 0;
		border: 0;
		border-top: 1.5px dashed var(--text-3);
		border-radius: 0;
	}
</style>
