<script lang="ts">
	import EventTable from '#lib/components/team/EventTable.svelte';
	import FollowedTeams from '#lib/components/team/FollowedTeams.svelte';
	import PitDisplayLink from '#lib/components/team/PitDisplayLink.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { searchDialog } from '#lib/ui/search.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>PitStop</title>
	<meta
		name="description"
		content="FTC event results, team stats and a pit display for your team's matches."
	/>
</svelte:head>

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
		<EventTable
			rows={data.today}
			caption="Events running today"
			datesHeader="Day"
			statusHeader="Status"
		/>
	{/if}
</section>

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
</style>
