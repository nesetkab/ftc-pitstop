<script lang="ts">
	import { fixed, integer } from '#lib/format/index.ts';
	import Table from '#lib/ui/Table.svelte';
	import { seasonRange, type AccuracyReport, type CalibrationBin } from './accuracy.ts';
	import CalibrationChart, { type CalibrationSeries } from './CalibrationChart.svelte';

	interface Props {
		report: AccuracyReport;
	}

	let { report }: Props = $props();

	const series = $derived<CalibrationSeries[]>(
		[
			{ label: seasonRange(report.method.validation), bins: report.calibration?.validation ?? [] },
			{ label: seasonRange(report.method.test), bins: report.calibration?.test ?? [] }
		].filter((entry) => entry.bins.length > 0)
	);
	const edges = $derived((series[0]?.bins ?? []).map((bin) => ({ lo: bin.lo, hi: bin.hi })));

	const percent = (value: number) => `${fixed(value * 100, 1)}%`;
	const range = (lo: number, hi: number) => `${Math.round(lo * 100)}% to ${Math.round(hi * 100)}%`;
	const shortRange = (lo: number, hi: number) => `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`;

	function binAt(entry: CalibrationSeries, lo: number): CalibrationBin | undefined {
		return entry.bins.find((bin) => bin.lo === lo);
	}
</script>

{#if series.length > 0}
	<CalibrationChart
		{series}
		label="Predicted chance that red wins against how often red won"
		xTitle="Predicted chance that red wins"
		yTitle="Share of matches red won"
		table={false}
	/>
	<Table>
		<thead>
			{#each [3, 2] as span (span)}
				<tr class={span === 3 ? 'full' : 'short'}>
					<td></td>
					{#each series as entry (entry.label)}
						<th class="group sep" scope="colgroup" colspan={span}>{entry.label}</th>
					{/each}
				</tr>
			{/each}
			<tr>
				<th class="l" scope="col" aria-label="Predicted range">
					<span class="full">Predicted range</span>
					<span class="short">Range</span>
				</th>
				{#each series as entry (entry.label)}
					<th class="sep" scope="col" aria-label="Predicted">
						<span class="full">Predicted</span>
						<span class="short">Pred.</span>
					</th>
					<th scope="col">Won</th>
					<th class="opt" scope="col">Matches</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each edges as edge (edge.lo)}
				<tr>
					<td class="l">
						<span class="full">{range(edge.lo, edge.hi)}</span>
						<span class="short" aria-hidden="true">{shortRange(edge.lo, edge.hi)}</span>
						<span class="short visually-hidden">{range(edge.lo, edge.hi)}</span>
					</td>
					{#each series as entry (entry.label)}
						{@const bin = binAt(entry, edge.lo)}
						<td class="sep">{bin ? percent(bin.predicted) : ''}</td>
						<td>{bin ? percent(bin.observed) : ''}</td>
						<td class="opt">{bin ? integer(bin.n) : ''}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}

<style>
	.short {
		display: none;
	}

	@media (max-width: 600px) {
		.full {
			display: none;
		}

		span.short {
			display: inline;
		}

		tr.short {
			display: table-row;
		}
	}
</style>
