<script lang="ts">
	import { page } from '$app/state';
	import FollowedTeams from '#lib/components/home/FollowedTeams.svelte';
	import Highlights from '#lib/components/home/Highlights.svelte';
	import TodayEvents from '#lib/components/home/TodayEvents.svelte';
	import EventTable from '#lib/components/team/EventTable.svelte';
	import PitDisplayLink from '#lib/components/team/PitDisplayLink.svelte';
	import { SEASON_NAME, SITE_NAME } from '#lib/seo.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { searchDialog } from '#lib/ui/search.svelte.ts';
	import Seo from '#lib/ui/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const website = $derived({
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: SITE_NAME,
		url: `${page.url.origin}/`,
		description: 'FIRST Tech Challenge event results, rankings and team stats.'
	});
</script>

<Seo
	title="PitStop: FTC event results, rankings and team stats"
	description="Live FIRST Tech Challenge results, rankings, match predictions and team OPR for the {SEASON_NAME} season, plus a pit display for your team's matches."
	path="/"
	data={[website]}
/>

<h1 class="visually-hidden">PitStop</h1>

<button
	type="button"
	class="search"
	aria-haspopup="dialog"
	aria-keyshortcuts="/ Control+K Meta+K"
	onclick={() => (searchDialog.open = true)}
>
	<span>Search teams and events</span>
	<kbd aria-hidden="true">/</kbd>
</button>

<FollowedTeams />

<section aria-labelledby="today-title">
	<h2 class="sec-title" id="today-title">Events today</h2>
	{#if data.today === null}
		<EmptyState title="Today's events could not be loaded.">Try again in a moment.</EmptyState>
	{:else if data.today.length === 0}
		<EmptyState title="No events are running today." />
	{:else}
		<TodayEvents rows={data.today} />
	{/if}
</section>

{#if data.highlights}
	<Highlights highlights={data.highlights} />
{/if}

<section aria-labelledby="week-title">
	<h2 class="sec-title" id="week-title">This week</h2>
	{#if data.week === null}
		<EmptyState title="This week's events could not be loaded.">Try again in a moment.</EmptyState>
	{:else if data.week.length === 0}
		<EmptyState title="No events start in the next 7 days." />
	{:else}
		<EventTable
			rows={data.week}
			caption="Events starting in the next 7 days"
			datesHeader="Dates"
			statusHeader="Starts"
		/>
	{/if}
	<p class="more"><a href="/events">All events this season</a></p>
</section>

<PitDisplayLink />

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		max-width: 560px;
		padding: 11px 14px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--text-3);
		font-size: 16px;
		text-align: left;
	}

	.search:hover {
		border-color: var(--text-3);
		color: var(--text-2);
	}

	.search kbd {
		margin-left: auto;
	}

	section {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
		align-content: start;
	}

	.more {
		font-size: 14px;
	}

	@media (hover: none) {
		.search kbd {
			display: none;
		}
	}

	@media (pointer: coarse) {
		.more a {
			display: inline-block;
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
