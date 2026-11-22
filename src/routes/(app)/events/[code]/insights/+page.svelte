<script lang="ts">
	import { getEventView } from '#lib/components/event/context.ts';
	import InsightAverages from '#lib/components/event/InsightAverages.svelte';
	import { INSIGHT_PARTS, insightQuery } from '#lib/components/event/insights.ts';
	import InsightsTable from '#lib/components/event/InsightsTable.svelte';
	import { integer } from '#lib/format/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const code = $derived(data.bundle.event.code);
	const base = $derived(`/events/${code}/insights`);
	const averages = $derived(data.averages);
	const basis = $derived(averages.playoff ? 'all matches' : 'quals');
	const levels = [
		{ key: '', label: 'All matches' },
		{ key: 'qual', label: 'Quals' },
		{ key: 'playoff', label: 'Playoffs' }
	] as const;
	const sortLabel = $derived(
		INSIGHT_PARTS.find((part) => part.key === data.filters.sort)?.label.toLowerCase() ?? 'total'
	);
	const hidden = $derived(data.total - data.rows.length);
	const csvHref = $derived(
		`/events/${code}/insights.csv${insightQuery({ ...data.filters, all: false })}`
	);
</script>

{#if !averages.event}
	<EmptyState title="No scores yet.">Insights show here as soon as matches are played.</EmptyState>
{:else}
	<section class="panel averages" aria-labelledby="averages-title">
		<h2 class="sec-title" id="averages-title">Average alliance score</h2>
		<InsightAverages {...averages} />
		<p class="note">
			From {integer(averages.event.count)} alliance scores. Scores leave out points from the other alliance's
			fouls. Tips is a count, not points.
			{#if averages.season}
				Season is every alliance score this season. Vs season compares this event's {basis} average with
				it.
			{:else}
				The season comparison shows once season data has loaded.
			{/if}
		</p>
	</section>

	<section class="panel" aria-labelledby="scores-title">
		<div class="head">
			<h2 class="sec-title" id="scores-title">Highest scores</h2>
			<nav class="levels" aria-label="Match type">
				{#each levels as level (level.key)}
					<a
						href="{base}{insightQuery({ ...data.filters, level: level.key, all: false })}"
						aria-current={data.filters.level === level.key ? 'page' : undefined}
						data-sveltekit-noscroll>{level.label}</a
					>
				{/each}
			</nav>
		</div>
		<InsightsTable {code} rows={data.rows} filters={data.filters} followed={view.followed} />
		<p class="note">
			Sorted by {sortLabel}. Each match counts twice, once for each alliance. Click a column to sort
			by it.
		</p>
		<p class="links">
			{#if hidden > 0}
				<a href="{base}{insightQuery({ ...data.filters, all: true })}" data-sveltekit-noscroll
					>Show all {integer(data.total)} scores</a
				>
			{/if}
			{#if data.total > 0}
				<a href={csvHref} download>Download CSV</a>
			{/if}
		</p>
	</section>
{/if}

<style>
	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
		align-content: start;
		min-width: 0;
	}

	.averages {
		max-width: 760px;
	}

	.panel + .panel {
		margin-top: 12px;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 20px;
		align-items: baseline;
		justify-content: space-between;
	}

	.levels {
		display: flex;
		gap: 16px;
		font-size: 14px;
		color: var(--text-2);
	}

	.levels a {
		text-decoration: none;
	}

	.levels a:hover {
		color: var(--text);
	}

	.levels a[aria-current='page'] {
		color: var(--text);
		font-weight: 600;
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 20px;
		font-size: 14px;
	}

	@media (pointer: coarse) {
		.levels a,
		.links a {
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
