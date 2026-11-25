<script lang="ts">
	import { getEventView } from '#lib/components/event/context.ts';
	import InsightAverages from '#lib/components/event/InsightAverages.svelte';
	import { insightQuery } from '#lib/components/event/insights.ts';
	import InsightsTable from '#lib/components/event/InsightsTable.svelte';
	import { integer } from '#lib/format/index.ts';
	import DownloadLink from '#lib/ui/DownloadLink.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const code = $derived(data.bundle.event.code);
	const base = $derived(`/events/${code}/insights`);
	const averages = $derived(data.averages);
	const levels = $derived(
		(
			[
				{ value: '', label: 'All matches' },
				{ value: 'qual', label: 'Quals' },
				{ value: 'playoff', label: 'Playoffs' }
			] as const
		).map((level) => ({
			...level,
			href: `${base}${insightQuery({ ...data.filters, level: level.value, all: false })}`
		}))
	);
	const hidden = $derived(data.total - data.rows.length);
	const csvHref = $derived(
		`/events/${code}/insights.csv${insightQuery({ ...data.filters, all: false })}`
	);
</script>

{#if !averages.event}
	<EmptyState title="Insights show here once matches are played." />
{:else}
	<section class="panel" aria-labelledby="averages-title">
		<h2 class="sec-title" id="averages-title">Average alliance score</h2>
		<InsightAverages {...averages} />
	</section>

	<section class="panel" aria-labelledby="scores-title">
		<div class="head">
			<h2 class="sec-title" id="scores-title">Highest scores</h2>
			<Segmented label="Match type" options={levels} value={data.filters.level} />
		</div>
		<InsightsTable {code} rows={data.rows} filters={data.filters} followed={view.followed} />
		<p class="links">
			{#if hidden > 0}
				<a href="{base}{insightQuery({ ...data.filters, all: true })}" data-sveltekit-noscroll
					>Show all {integer(data.total)} scores</a
				>
			{/if}
			{#if data.total > 0}
				<DownloadLink href={csvHref} />
			{/if}
		</p>
	</section>
{/if}

<style>
	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-title);
		align-content: start;
		min-width: 0;
	}

	.panel + .panel {
		margin-top: 12px;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 20px;
		align-items: center;
		justify-content: space-between;
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 20px;
		font-size: 14px;
	}

	@media (pointer: coarse) {
		.links a {
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
