<script lang="ts">
	import { fixed } from '#lib/format/index.ts';
	import { RP_THRESHOLDS } from '#lib/game/biobuzz.ts';
	import Table from '#lib/ui/Table.svelte';
	import { baseRateBrier, type AccuracyReport, type RpResult } from './accuracy.ts';
	import CalibrationChart from './CalibrationChart.svelte';

	interface Props {
		rp: NonNullable<AccuracyReport['rp']>;
	}

	let { rp }: Props = $props();

	const rows = $derived(
		[
			{ key: 'swarm', label: `Swarm, leave and park ${RP_THRESHOLDS.swarm}+`, result: rp.swarm },
			{
				key: 'pollinator1',
				label: `Pollinator 1, ${RP_THRESHOLDS.pollinator1}+ tips`,
				result: rp.pollinator1
			},
			{
				key: 'pollinator2',
				label: `Pollinator 2, ${RP_THRESHOLDS.pollinator2}+ tips`,
				result: rp.pollinator2
			}
		].filter((row): row is { key: string; label: string; result: RpResult } => Boolean(row.result))
	);

	const percent = (value: number) => `${fixed(value * 100, 1)}%`;
</script>

<Table>
	<thead>
		<tr>
			<th class="l" scope="col">Ranking point</th>
			<th scope="col">Earned in</th>
			<th scope="col">Brier score</th>
			<th scope="col">Brier score from the base rate alone</th>
			<th scope="col">Log loss</th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.key)}
			<tr>
				<td class="l">{row.label}</td>
				<td>{percent(row.result.rate)}</td>
				<td>{fixed(row.result.brier, 3)}</td>
				<td>{fixed(baseRateBrier(row.result.rate), 3)}</td>
				<td>{fixed(row.result.logloss, 3)}</td>
			</tr>
		{/each}
	</tbody>
</Table>

<div class="charts">
	{#each rows as row (row.key)}
		<figure>
			<figcaption>{row.label}</figcaption>
			<CalibrationChart
				series={[{ label: String(rp.season), bins: row.result.calibration }]}
				label="{row.label}: predicted chance against how often it was earned"
				xTitle="Predicted chance"
				yTitle="Share earned"
			/>
		</figure>
	{/each}
</div>

<style>
	.charts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 24px;
	}

	figure {
		display: grid;
		gap: 6px;
		margin: 0;
		min-width: 0;
		align-content: start;
	}

	figcaption {
		font-size: 14px;
		font-weight: 500;
	}

	@media (max-width: 900px) {
		.charts {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
