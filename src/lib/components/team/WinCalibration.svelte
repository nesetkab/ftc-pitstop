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
			<tr>
				<td></td>
				{#each series as entry (entry.label)}
					<th class="group sep" scope="colgroup" colspan="3">{entry.label}</th>
				{/each}
			</tr>
			<tr>
				<th class="l" scope="col">Predicted range</th>
				{#each series as entry (entry.label)}
					<th class="sep" scope="col">Predicted</th>
					<th scope="col">Won</th>
					<th scope="col">Matches</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each edges as edge (edge.lo)}
				<tr>
					<td class="l">{range(edge.lo, edge.hi)}</td>
					{#each series as entry (entry.label)}
						{@const bin = binAt(entry, edge.lo)}
						<td class="sep">{bin ? percent(bin.predicted) : ''}</td>
						<td>{bin ? percent(bin.observed) : ''}</td>
						<td>{bin ? integer(bin.n) : ''}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}
