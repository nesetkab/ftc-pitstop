<script lang="ts">
	import LeaderboardFilters from '#lib/components/team/LeaderboardFilters.svelte';
	import LeaderboardTable from '#lib/components/team/LeaderboardTable.svelte';
	import Pagination from '#lib/components/team/Pagination.svelte';
	import { queryString } from '#lib/components/team/leaderboard.ts';
	import { integer } from '#lib/format/index.ts';
	import { SEASON_NAME, siteTitle } from '#lib/seo.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const first = $derived(data.start + 1);
	const last = $derived(data.start + data.rows.length);
</script>

<Seo
	title={siteTitle(`FTC team leaderboards by OPR, ${SEASON_NAME}`)}
	description="Every FTC team ranked by OPR in the {SEASON_NAME} season, with auto, teleop and tips OPR, matches and events. Filter by region, country or state."
	path="/leaderboards"
/>

<PageHeader
	title="Leaderboards"
	meta="Teams ranked by OPR this season. OPR is the points a team adds to its alliance's score."
>
	{#snippet status()}
		<StaleNotice updated={data.updated} staleAfter={86400} prefix="Updated" />
	{/snippet}
</PageHeader>

<LeaderboardFilters
	filters={data.filters}
	regions={data.regions}
	countries={data.countries}
	states={data.states}
/>

<p class="count" aria-live="polite">
	{#if data.total === 0}
		No teams
	{:else}
		Showing {integer(first)} to {integer(last)} of {integer(data.total)} teams
	{/if}
</p>

<LeaderboardTable rows={data.rows} start={data.start} />

<Pagination
	page={data.page}
	pages={data.pages}
	href={(page) => `/leaderboards${queryString(data.filters, page)}`}
/>

{#if data.source === 'scout'}
	<p class="note">
		Season ratings are not available yet. Teams are ranked by their best event OPR from FTCScout,
		and only the top {integer(data.population)} teams are listed. Matches are qualification matches at
		that event.
	</p>
{:else}
	<p class="note">Matches is the number of matches behind each rating.</p>
{/if}

<style>
	.count {
		font-size: 14px;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}
</style>
