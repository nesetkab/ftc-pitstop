<script lang="ts">
	import { tick } from 'svelte';
	import LeaderboardFilters from '#lib/components/leaderboard/LeaderboardFilters.svelte';
	import LeaderboardTable from '#lib/components/leaderboard/LeaderboardTable.svelte';
	import Pagination from '#lib/ui/Pagination.svelte';
	import {
		LEADERBOARD_SORTS,
		queryString,
		typeLabel,
		windowLabel
	} from '#lib/components/leaderboard/leaderboard.ts';
	import { integer } from '#lib/format/index.ts';
	import { SEASON_NAME, siteTitle } from '#lib/seo.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const first = $derived(data.start + 1);
	const last = $derived(data.start + data.rows.length);
	const sortLabel = $derived(
		LEADERBOARD_SORTS.find((sort) => sort.key === data.filters.sort)?.label ?? 'OPR'
	);
	const scope = $derived(
		[
			data.filters.type ? typeLabel(data.filters.type) : '',
			windowLabel(data.window, data.filters.dates === 'recent')
		].filter(Boolean)
	);
	const scoped = $derived(scope.length > 0);
	const summary = $derived(
		[
			scope.join(', '),
			data.filters.sort === 'opr'
				? ''
				: `sorted by ${data.filters.sort === 'matches' ? 'matches' : `${sortLabel.toLowerCase()} OPR`}`,
			data.filters.q ? `matching "${data.filters.q}"` : ''
		]
			.filter(Boolean)
			.join(', ')
			.replace(/^./, (letter) => letter.toUpperCase())
	);
	const missing = $derived(data.filters.team > 0 && !data.found);
	const showing = $derived(
		`${summary ? `${summary}. ` : ''}Showing ${integer(first)} to ${integer(last)} of ${integer(data.total)} teams`
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
	title={siteTitle(`FTC team leaderboards by OPR, ${SEASON_NAME}`)}
	description="Every FTC team ranked by OPR in the {SEASON_NAME} season, with auto, teleop and tips OPR, matches and events. Filter by region, country or state, sort by any column and download a CSV."
	path="/leaderboards"
/>

<PageHeader
	title="Leaderboards"
	meta="Teams ranked by OPR this season. OPR is the points a team adds to its alliance's score."
>
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

<p class="count" aria-live="polite">
	{#if data.total === 0}
		No teams{missing ? '.' : ''}
	{:else}
		{showing}{missing ? '.' : ''}
	{/if}
	{#if missing}
		<span class="faint">Team {data.filters.team} is not in this list.</span>
	{/if}
</p>

<LeaderboardTable rows={data.rows} start={data.start} filters={data.filters} />

<Pagination
	page={data.page}
	pages={data.pages}
	href={(page) => `/leaderboards${queryString({ ...data.filters, team: 0 }, page)}`}
/>

{#if data.source === 'scout'}
	<p class="note">
		Season ratings are not available yet. Teams are ranked by their best event OPR from FTCScout,
		and only the top {integer(data.population)} teams are listed. Matches are qualification matches at
		that event.
	</p>
{:else if scoped}
	<p class="note">
		Each team's rating is as of its last event in this filter. Matches and events count only those
		events. Click a column to sort by it.
	</p>
{:else}
	<p class="note">
		Matches is the number of matches behind each rating. Click a column to sort by it.
	</p>
{/if}

{#if data.total > 0}
	<p class="csv"><a href={csvHref} download>Download CSV</a></p>
{/if}

<style>
	.count {
		font-size: 14px;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	.csv {
		font-size: 14px;
	}
</style>
