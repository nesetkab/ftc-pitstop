<script lang="ts">
	import RecordsTable from '#lib/components/records/RecordsTable.svelte';
	import type { RecordFilters } from '#lib/components/records/records.ts';
	import EventTable from '#lib/components/team/EventTable.svelte';
	import FollowedTeams from '#lib/components/team/FollowedTeams.svelte';
	import PitDisplayLink from '#lib/components/team/PitDisplayLink.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { searchDialog } from '#lib/ui/search.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const recent: RecordFilters = {
		part: 'total',
		range: '7',
		region: '',
		type: '',
		level: '',
		team: null,
		page: 1
	};
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

{#if data.records}
	<section aria-labelledby="records-title">
		<h2 class="sec-title" id="records-title">Highest scores in the last 7 days</h2>
		<RecordsTable
			rows={data.records.rows}
			filters={recent}
			names={data.records.names}
			sortable={false}
			compact
			caption="Highest alliance scores in the last 7 days"
		/>
		<p class="more">
			<a href="/records?range=7">More records</a>
			<span class="faint">·</span>
			<a href="/compare">Compare teams</a>
		</p>
	</section>
{/if}

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
