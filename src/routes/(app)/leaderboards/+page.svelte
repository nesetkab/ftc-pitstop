<script lang="ts">
	import { tick } from 'svelte';
	import LeaderboardFilters from '#lib/components/leaderboard/LeaderboardFilters.svelte';
	import LeaderboardTable from '#lib/components/leaderboard/LeaderboardTable.svelte';
	import DownloadLink from '#lib/ui/DownloadLink.svelte';
	import Pagination from '#lib/ui/Pagination.svelte';
	import { hasFilters, queryString } from '#lib/components/leaderboard/leaderboard.ts';
	import { integer } from '#lib/format/index.ts';
	import { SEASON_NAME, siteTitle } from '#lib/seo.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const first = $derived(data.start + 1);
	const last = $derived(data.start + data.rows.length);
	const matchesShown = $derived(data.filters.sort === 'matches');
	const scoped = $derived(data.filters.type !== '' || data.window !== null);
	const missing = $derived(data.filters.team > 0 && !data.found);
	const showing = $derived(
		`Showing ${integer(first)} to ${integer(last)} of ${integer(data.total)} teams`
	);
	const regionLabel = $derived(
		data.filters.region
			? (data.regions.find((option) => option.value === data.filters.region)?.label ?? null)
			: null
	);
	const csvHref = $derived(`/leaderboards.csv${queryString({ ...data.filters, team: 0 }, 1)}`);

	$effect(() => {
		if (!data.found) return;
		tick().then(() => {
			document
				.querySelector('tr[aria-current="true"]')
				?.scrollIntoView({ block: 'center', behavior: 'instant' });
		});
	});
</script>

<Seo
	title={siteTitle(`FTC team leaderboards by aOPR, ${SEASON_NAME}`)}
	description="Every FTC team ranked by aOPR in the {SEASON_NAME} season, with auto, teleop and tips aOPR, matches and events. Filter by region, country or state, sort by any column and download a CSV."
	path="/leaderboards"
/>

<PageHeader title="Leaderboards" meta="aOPR is the points a team adds to its alliance's score.">
	{#snippet status()}
		<StaleNotice updated={data.updated} staleAfter={86400} prefix="Updated" />.
		<a href="/about">How the numbers work</a>
	{/snippet}
</PageHeader>

<LeaderboardFilters
	filters={data.filters}
	regions={data.regions}
	countries={data.countries}
	states={data.states}
	types={data.types}
	weeks={data.weeks}
/>

{#if data.total > 0}
	<p class="count" aria-live="polite">
		<span>
			{showing}{missing ? '.' : ''}
			{#if missing}
				<span class="faint">Team {data.filters.team} is not in this list.</span>
			{/if}
		</span>
		{#if regionLabel || hasFilters(data.filters)}
			<span class="links">
				{#if regionLabel}
					<a href="/regions/{data.filters.region}">{regionLabel} region page</a>
				{/if}
				{#if hasFilters(data.filters)}
					<a href="/leaderboards">Clear filters</a>
				{/if}
			</span>
		{/if}
	</p>
{/if}

<LeaderboardTable rows={data.rows} start={data.start} filters={data.filters} />

<Pagination
	page={data.page}
	pages={data.pages}
	href={(page) => `/leaderboards${queryString({ ...data.filters, team: 0 }, page)}`}
/>

{#if data.source === 'scout'}
	<p class="note">
		Season ratings are not available yet. Teams are ranked by their best event OPR from FTCScout,
		and only the top {integer(data.population)} teams are listed.
		<span class={{ 'phone-off': !matchesShown }}
			>Matches are qualification matches at that event.</span
		>
	</p>
{:else if data.total > 0 && scoped}
	<p class="note">
		Each team's rating is as of its last event in this filter.
		<span class={{ 'phone-off': !matchesShown }}>Matches and events count only those events.</span>
	</p>
{:else if data.total > 0}
	<p class={['note', { 'phone-off': !matchesShown }]}>
		Matches is the number of matches behind each rating.
	</p>
{/if}

{#if data.total > 0}
	<p class="csv"><DownloadLink href={csvHref} /></p>
{/if}

<style>
	.count {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 16px;
		font-size: 14px;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	.links {
		display: flex;
		gap: 16px;
		margin-left: auto;
		white-space: nowrap;
	}

	.csv {
		font-size: 14px;
	}

	@media (max-width: 600px) {
		.phone-off {
			display: none;
		}
	}
</style>
