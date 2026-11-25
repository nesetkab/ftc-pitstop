<script lang="ts">
	import { page } from '$app/state';
	import FollowedTeams from '#lib/components/home/FollowedTeams.svelte';
	import Highlights from '#lib/components/home/Highlights.svelte';
	import Intro from '#lib/components/home/Intro.svelte';
	import TodayEvents from '#lib/components/home/TodayEvents.svelte';
	import WorldRecord from '#lib/components/home/WorldRecord.svelte';
	import EventTable from '#lib/components/home/EventTable.svelte';
	import PitDisplayLink from '#lib/components/team/PitDisplayLink.svelte';
	import { SEASON_NAME, SITE_NAME } from '#lib/seo.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const WEEK_ROWS = 6;

	const website = $derived({
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: SITE_NAME,
		url: `${page.url.origin}/`,
		description: 'FIRST Tech Challenge event results, rankings and team stats.'
	});
	const live = $derived(data.today?.filter((row) => row.state === 'live').length ?? 0);
</script>

<Seo
	title="PitStop: FTC event results, rankings and team stats"
	description="Live FIRST Tech Challenge results, rankings, match predictions and team aOPR for the {SEASON_NAME} season, plus a pit display for your team's matches."
	path="/"
	data={[website]}
/>

<h1 class="visually-hidden">PitStop</h1>

<div class="home">
	<div class="top">
		<div class="start">
			<Intro />
			<FollowedTeams />
		</div>
		<PitDisplayLink />
		{#if data.record}
			<div class="record">
				<WorldRecord record={data.record} />
			</div>
		{/if}
	</div>

	<section aria-labelledby="today-title">
		<div class="head">
			<h2 class="sec-title" id="today-title">Events today</h2>
			{#if live > 0 && data.today}
				<p class="aside">{live} of {data.today.length} running now</p>
			{/if}
		</div>
		{#if data.today === null}
			<EmptyState title="Today's events couldn't be loaded." />
		{:else if data.today.length === 0}
			<EmptyState title="No events are running today.">Live events show here.</EmptyState>
		{:else}
			<TodayEvents rows={data.today} />
		{/if}
	</section>

	{#if data.highlights}
		<Highlights highlights={data.highlights} />
	{/if}

	<section aria-labelledby="week-title">
		<div class="head">
			<h2 class="sec-title" id="week-title">Starting this week</h2>
			<a class="aside" href="/events">
				{data.week && data.week.length > WEEK_ROWS
					? `All ${data.week.length} events this week`
					: 'All events'}
			</a>
		</div>
		{#if data.week === null}
			<EmptyState title="This week's events couldn't be loaded." />
		{:else if data.week.length === 0}
			<EmptyState title="No events start in the next 7 days." />
		{:else}
			<EventTable
				rows={data.week.slice(0, WEEK_ROWS)}
				caption="Events starting in the next 7 days"
			/>
		{/if}
	</section>
</div>

<style>
	.home {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-section);
	}

	.top {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-section);
		align-items: start;
	}

	.start {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-section);
	}

	@media (min-width: 900px) {
		.top {
			grid-template-columns: minmax(0, 1fr) minmax(0, 380px);
			column-gap: 72px;
		}

		.start {
			grid-row: span 2;
		}

		.record {
			grid-column: 2;
		}
	}

	section {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-title);
		align-content: start;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 16px;
	}

	.aside {
		font-size: 14px;
		color: var(--text-2);
	}

	a.aside:hover {
		color: var(--text);
	}

	@media (max-width: 899px) {
		.top {
			display: contents;
		}

		.top > :global(#pit) {
			order: 1;
		}
	}

	@media (pointer: coarse) {
		a.aside {
			display: inline-block;
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
