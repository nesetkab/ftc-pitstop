<script lang="ts">
	import RecordFilters from '#lib/components/records/RecordFilters.svelte';
	import RecordsTable from '#lib/components/records/RecordsTable.svelte';
	import {
		RECORD_PARTS,
		RECORD_RANGES,
		RECORDS_CSV_LIMIT,
		recordQuery
	} from '#lib/components/records/records.ts';
	import Pagination from '#lib/components/team/Pagination.svelte';
	import { integer } from '#lib/format/index.ts';
	import { SEASON_NAME, siteTitle } from '#lib/seo.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const first = $derived(data.start + 1);
	const last = $derived(data.start + data.rows.length);
	const part = $derived(RECORD_PARTS.find((entry) => entry.key === data.filters.part)!);
	const range = $derived(RECORD_RANGES.find((entry) => entry.key === data.filters.range)!);
	const team = $derived(data.filters.team);
	const teamName = $derived(team ? data.names.teams[team] : undefined);
	const summary = $derived(
		[
			part.key === 'total'
				? 'Sorted by total score'
				: `Sorted by ${part.label.toLowerCase()} points`,
			range.key === 'all' ? '' : range.label.toLowerCase(),
			team ? `alliances with ${team}${teamName ? ` ${teamName}` : ''}` : ''
		]
			.filter(Boolean)
			.join(', ')
	);
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

<p class="count" aria-live="polite">
	{#if data.total === 0}
		No matches
	{:else}
		{summary}. Showing {integer(first)} to {integer(last)} of {integer(data.total)} alliance scores.
	{/if}
</p>

<RecordsTable rows={data.rows} filters={data.filters} names={data.names} />

<Pagination
	page={data.page}
	pages={data.pages}
	href={(page) => `/records${recordQuery(data.filters, page)}`}
/>

<p class="note">
	Each match counts twice, once for each alliance. Hive, flower and garden are teleop points.
	Opponent is the other alliance's score. Click a column to sort by it.
</p>

{#if data.total > 0}
	<p class="csv">
		<a href="/records.csv{recordQuery({ ...data.filters, page: 1 })}" download>Download CSV</a>
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

	.count {
		font-size: 14px;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}
</style>
