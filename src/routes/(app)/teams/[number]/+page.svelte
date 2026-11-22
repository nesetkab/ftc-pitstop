<script lang="ts">
	import { page } from '$app/state';
	import Comparison from '#lib/components/team/Comparison.svelte';
	import FollowButton from '#lib/components/team/FollowButton.svelte';
	import LastSeason from '#lib/components/team/LastSeason.svelte';
	import OprCharts from '#lib/components/team/OprCharts.svelte';
	import TeamAwards from '#lib/components/team/TeamAwards.svelte';
	import TeamEvents from '#lib/components/team/TeamEvents.svelte';
	import TeamMatches from '#lib/components/team/TeamMatches.svelte';
	import TeamStats from '#lib/components/team/TeamStats.svelte';
	import { breadcrumbs, teamDescription, teamJsonLd, teamTitle } from '#lib/seo.ts';
	import Button from '#lib/ui/Button.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = $derived(data.view);
	const meta = $derived(
		[view.team.place, view.team.rookieYear ? `Rookie year ${view.team.rookieYear}` : '']
			.filter(Boolean)
			.join('. ')
	);
	const previousTitle = $derived(
		view.previous ? `Last season, ${view.previous.game ?? view.previous.season}` : ''
	);
</script>

<Seo
	title={teamTitle(view.team)}
	description={teamDescription(view.team, view.stats)}
	path="/teams/{view.team.number}"
	data={[
		teamJsonLd(page.url.origin, view.team),
		breadcrumbs(page.url.origin, [
			{ name: 'PitStop', path: '/' },
			{ name: 'Leaderboards', path: '/leaderboards' },
			{ name: `${view.team.number} ${view.team.name}`, path: `/teams/${view.team.number}` }
		])
	]}
/>

<PageHeader title="{view.team.number} {view.team.name}" meta={meta ? `${meta}.` : undefined}>
	{#snippet status()}
		{#if view.stale}
			Showing saved data. <StaleNotice updated={view.updated} />.
		{/if}
	{/snippet}
	{#snippet actions()}
		<FollowButton number={view.team.number} />
		<Button variant="secondary" href="/compare?teams={view.team.number}">Compare</Button>
		<Button variant="secondary" href="/{view.team.number}/tv">Pit display</Button>
		<Button variant="secondary" href="/{view.team.number}">Phone view</Button>
	{/snippet}
</PageHeader>

<TeamStats stats={view.stats} />

<div class="grid2">
	<section class="panel" aria-labelledby="opr-title">
		<h2 class="sec-title" id="opr-title">{view.chartTitle}</h2>
		<OprCharts charts={view.charts} />
	</section>
	<section class="panel" aria-labelledby="compare-title">
		<h2 class="sec-title" id="compare-title">Compared with all teams this season</h2>
		<Comparison rows={view.comparison} />
	</section>
</div>

<section class="panel" aria-labelledby="events-title">
	<h2 class="sec-title" id="events-title">Events</h2>
	<TeamEvents rows={view.events} />
	{#if view.stats.events > 0}
		<p class="more">
			<a href="/records?team={view.team.number}">Highest scores with {view.team.number}</a>
		</p>
	{/if}
</section>

{#if view.matches.length > 0}
	<section class="panel" aria-labelledby="matches-title">
		<h2 class="sec-title" id="matches-title">Matches</h2>
		<TeamMatches events={view.matches} team={view.team.number} />
	</section>
{/if}

{#if view.awards.length > 0}
	<section class="panel awards" aria-labelledby="awards-title">
		<h2 class="sec-title" id="awards-title">Awards</h2>
		<TeamAwards rows={view.awards} />
	</section>
{/if}

{#if view.previous}
	<section class="panel previous" aria-labelledby="previous-title">
		<h2 class="sec-title" id="previous-title">{previousTitle}</h2>
		<LastSeason previous={view.previous} />
	</section>
{/if}

<style>
	.grid2 {
		display: grid;
		grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
		gap: 28px;
		align-items: start;
	}

	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
		align-content: start;
		min-width: 0;
	}

	.previous {
		max-width: 520px;
	}

	.more {
		font-size: 14px;
	}

	.awards {
		max-width: 720px;
	}

	@media (max-width: 1060px) {
		.grid2 {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
