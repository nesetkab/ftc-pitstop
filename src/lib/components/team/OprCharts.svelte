<script lang="ts">
	import { fixed } from '#lib/format/index.ts';
	import LineChart from '#lib/ui/LineChart.svelte';
	import type { TeamChart } from './team-view.ts';

	interface Props {
		charts: TeamChart[];
	}

	let { charts }: Props = $props();

	const top = $derived(Math.max(0, ...charts.flatMap((chart) => chart.points.map((p) => p.value))));
	const perEvent = $derived(charts.length === 1 && charts[0].id === 'events');
</script>

<div class="charts">
	{#each charts as chart (chart.id)}
		<figure>
			{#if charts.length > 1}
				<figcaption>{chart.title}</figcaption>
			{/if}
			<LineChart
				points={chart.points}
				label={chart.label}
				divider={chart.divider ?? undefined}
				yMax={top}
				height={charts.length > 1 ? 170 : 220}
				xName={perEvent ? 'Event' : 'Match'}
				yName="OPR"
				format={(value) => fixed(value)}
			/>
		</figure>
	{/each}
</div>

<style>
	.charts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
		gap: 18px 28px;
	}

	figure {
		display: grid;
		gap: 4px;
		margin: 0;
		min-width: 0;
	}

	figcaption {
		font-size: 13px;
		color: var(--text-2);
	}
</style>
