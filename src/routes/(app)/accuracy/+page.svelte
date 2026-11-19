<script lang="ts">
	import AccuracyReport from '#lib/components/team/AccuracyReport.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Prediction accuracy - PitStop</title>
	<meta
		name="description"
		content="How PitStop's match predictions did when replayed on past FTC seasons: winner accuracy, Brier score, log loss, score error and calibration."
	/>
</svelte:head>

{#if data.report}
	<AccuracyReport report={data.report} sample={data.sample} />
{:else}
	<PageHeader title="Prediction accuracy" />
	<EmptyState title="Backtest results are not available yet." />
{/if}
