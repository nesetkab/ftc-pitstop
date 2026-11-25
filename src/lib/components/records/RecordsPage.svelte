<script lang="ts">
	import { integer } from '#lib/format/index.ts';
	import DownloadLink from '#lib/ui/DownloadLink.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Pagination from '#lib/ui/Pagination.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import RecordConditions from './RecordConditions.svelte';
	import RecordFilters from './RecordFilters.svelte';
	import RecordMenu from './RecordMenu.svelte';
	import RecordTable from './RecordTable.svelte';
	import {
		clearedRecords,
		conditionText,
		hasRecordFilters,
		recordQuery,
		RECORDS_CSV_LIMIT,
		type RankedRecord,
		type RecordFilters as Filters,
		type RecordOption
	} from './records.ts';

	interface Props {
		data: {
			updated: number | null;
			filters: Filters;
			rows: RankedRecord[];
			total: number;
			page: number;
			pages: number;
			regions: RecordOption[];
			types: RecordOption[];
			names: { teams: Record<number, string>; events: Record<string, string> };
		};
	}

	let { data }: Props = $props();

	function without(index: number) {
		const where = data.filters.where.filter((_, at) => at !== index);
		return `/records${recordQuery({ ...data.filters, where }, 1)}`;
	}
</script>

<PageHeader title="Season records" />

<div class="body">
	<div class="controls">
		<RecordFilters filters={data.filters} regions={data.regions} types={data.types} />
		<RecordMenu
			label="Score conditions"
			count={data.filters.where.length}
			panelLabel="Score conditions"
			width={520}
		>
			{#snippet children(close)}
				<RecordConditions filters={data.filters} ondone={close} />
			{/snippet}
		</RecordMenu>
	</div>

	{#if data.filters.where.length > 0}
		<ul class="conditions" aria-label="Score conditions">
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

	<div class="results">
		{#if data.total > 0}
			<p class="count" aria-live="polite">
				{integer(data.total)} alliance scores
				{#if hasRecordFilters(data.filters)}
					<a href={clearedRecords(data.filters)}>Clear filters</a>
				{/if}
			</p>
		{/if}
		<RecordTable rows={data.rows} filters={data.filters} names={data.names} />
	</div>
</div>

<Pagination
	page={data.page}
	pages={data.pages}
	href={(page) => `/records${recordQuery(data.filters, page)}`}
/>

{#if data.total > 0}
	<p class="foot">
		<DownloadLink href="/records.csv{recordQuery({ ...data.filters, page: 1 })}" />
		{#if data.total > RECORDS_CSV_LIMIT}
			<span>The file holds the top {integer(RECORDS_CSV_LIMIT)} scores.</span>
		{/if}
		<StaleNotice updated={data.updated} staleAfter={86400} prefix="Updated" />
	</p>
{/if}

<style>
	.body {
		display: grid;
		gap: 14px;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 12px;
	}

	.controls > :global(form) {
		flex: 0 1 auto;
	}

	.results {
		display: grid;
		gap: 10px;
	}

	.count {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin: 0;
		font-size: 14px;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	.conditions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 0;
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
		min-height: 32px;
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

	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 16px;
		font-size: 13.5px;
		color: var(--text-3);
	}

	@media (max-width: 640px) {
		.controls {
			align-items: start;
		}

		.controls > :global(form) {
			flex: 1 1 0;
			min-width: 0;
		}
	}
</style>
