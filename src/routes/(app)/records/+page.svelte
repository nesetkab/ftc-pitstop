<script lang="ts">
	import RecordConditions from '#lib/components/records/RecordConditions.svelte';
	import RecordFilters from '#lib/components/records/RecordFilters.svelte';
	import RecordMenu from '#lib/components/records/RecordMenu.svelte';
	import RecordStats from '#lib/components/records/RecordStats.svelte';
	import RecordsTable from '#lib/components/records/RecordsTable.svelte';
	import {
		clearedRecords,
		conditionText,
		hasRecordFilters,
		RECORDS_CSV_LIMIT,
		recordQuery
	} from '#lib/components/records/records.ts';
	import DownloadLink from '#lib/ui/DownloadLink.svelte';
	import Pagination from '#lib/ui/Pagination.svelte';
	import { integer } from '#lib/format/index.ts';
	import { SEASON_NAME, siteTitle } from '#lib/seo.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const first = $derived(data.start + 1);
	const last = $derived(data.start + data.rows.length);

	function without(index: number) {
		const where = data.filters.where.filter((_, at) => at !== index);
		return `/records${recordQuery({ ...data.filters, where }, 1)}`;
	}
</script>

<Seo
	title={siteTitle(`FTC high scores and season records, ${SEASON_NAME}`)}
	description="The highest FTC alliance scores of the {SEASON_NAME} season, ranked by total, auto, teleop, hive, flower and garden points. Filter by date, region, event type and team."
	path="/records"
/>

<PageHeader
	title="Season records"
	meta="The highest alliance scores this season. Scores leave out points from the other alliance's fouls."
>
	{#snippet status()}
		<StaleNotice updated={data.updated} staleAfter={86400} prefix="Updated" />
	{/snippet}
</PageHeader>

<RecordFilters filters={data.filters} regions={data.regions} types={data.types} />

<div class="bar">
	<p class="count" aria-live="polite">
		{#if data.total > 0}
			Showing {integer(first)} to {integer(last)} of {integer(data.total)} alliance scores
		{:else}
			No alliance scores
		{/if}
	</p>
	<div class="tools">
		{#if hasRecordFilters(data.filters)}
			<a class="clear" href={clearedRecords(data.filters)}>Clear filters</a>
		{/if}
		<RecordMenu
			label="Custom filters"
			count={data.filters.where.length}
			panelLabel="Custom filters"
			width={520}
		>
			{#snippet children(close)}
				<RecordConditions filters={data.filters} ondone={close} />
			{/snippet}
		</RecordMenu>
		<RecordMenu label="Statistics" panelLabel="Choose statistics" width={380}>
			{#snippet children(close)}
				<RecordStats filters={data.filters} ondone={() => close(true)} />
			{/snippet}
		</RecordMenu>
	</div>
</div>

{#if data.filters.where.length > 0}
	<ul class="conditions" aria-label="Custom filters">
		{#each data.filters.where as condition, index (`${index}:${conditionText(condition)}`)}
			{#if index > 0}
				<li class="joiner" aria-hidden="true">{data.filters.match === 'any' ? 'or' : 'and'}</li>
			{/if}
			<li>
				<a class="chip" href={without(index)} aria-label="Remove {conditionText(condition)}"
					>{conditionText(condition)}
					<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
						<path d="M2 2 8 8M8 2 2 8" />
					</svg></a
				>
			</li>
		{/each}
	</ul>
{/if}

<RecordsTable rows={data.rows} filters={data.filters} names={data.names} />

<Pagination
	page={data.page}
	pages={data.pages}
	href={(page) => `/records${recordQuery(data.filters, page)}`}
/>

{#if data.total > 0}
	<p class="note">
		Each match counts twice, once for each alliance. Opponent is the other alliance's score.
	</p>

	<p class="csv">
		<DownloadLink href="/records.csv{recordQuery({ ...data.filters, page: 1 })}" />
		{#if data.total > RECORDS_CSV_LIMIT}
			<span class="faint">The top {integer(RECORDS_CSV_LIMIT)} scores for these filters.</span>
		{/if}
	</p>
{/if}

<style>
	.csv {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		font-size: 14px;
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 16px;
	}

	.count {
		margin: 0;
		font-size: 14px;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.clear {
		margin-right: 8px;
		font-size: 14px;
	}

	.conditions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: -4px 0 0;
		padding: 0;
		list-style: none;
		font-size: 13px;
	}

	.joiner {
		color: var(--text-3);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px 4px 10px;
		border: 1px solid var(--line-2);
		border-radius: 999px;
		color: var(--text);
		text-decoration: none;
		font-variant-numeric: tabular-nums;
	}

	.chip:hover {
		background: var(--surface);
	}

	.chip svg {
		fill: none;
		stroke: var(--text-3);
		stroke-width: 1.5;
		stroke-linecap: round;
	}
</style>
