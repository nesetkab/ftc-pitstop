<script lang="ts">
	import { goto } from '$app/navigation';
	import { isAhead } from '#lib/components/advancement/advancement.ts';
	import ChampionshipTable from '#lib/components/advancement/ChampionshipTable.svelte';
	import { watchFollowed } from '#lib/components/event/follow.ts';
	import { typeLabel } from '#lib/components/event/event-meta.ts';
	import { integer } from '#lib/format/number.ts';
	import { regionName } from '#lib/format/places.ts';
	import { shortRange } from '#lib/format/time.ts';
	import { SEASON_NAME, siteTitle } from '#lib/seo.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let followed = $state<ReadonlySet<number>>(new Set());

	$effect(() => watchFollowed((teams) => (followed = new Set(teams))));

	const regional = $derived(data.rows.filter((row) => row.level === 'regional'));
	const world = $derived(data.rows.filter((row) => row.level === 'world'));
	const advanced = $derived(regional.reduce((sum, row) => sum + row.advanced, 0));
	const ahead = $derived(regional.reduce((sum, row) => sum + row.feeders - row.played, 0));
	const where = $derived(data.region ? regionName(data.region) : null);
	const mine = $derived(
		data.rows.flatMap((row) =>
			row.teams.filter((team) => followed.has(team)).map((team) => ({ team, row }))
		)
	);

	function choose(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		goto(value ? `?region=${value}` : '?', { reset: false });
	}
</script>

<Seo
	title={siteTitle(`FTC advancement tracker, ${SEASON_NAME}`)}
	description="Which FTC teams have advanced to each regional championship and the FIRST Championship so far this season, how they earned it, and which qualifiers are still to play."
	path={data.region ? `/advancement?region=${data.region}` : '/advancement'}
/>

<PageHeader
	title={where ? `Advancement in ${where}` : 'Advancement'}
	meta="Who has advanced to each championship so far, how they earned it, and which events are still to play."
>
	{#snippet status()}
		<StaleNotice updated={data.updated} staleAfter={7200} prefix="Updated" />
	{/snippet}
</PageHeader>

{#if mine.length > 0}
	<section class="yours" aria-labelledby="yours-title">
		<h2 class="sec-title" id="yours-title">Your teams</h2>
		<ul>
			{#each mine as entry (`${entry.team}:${entry.row.code}`)}
				<li>
					<TeamChip number={entry.team} me href="/teams/{entry.team}" />
					advanced to
					<a href="/advancement/{entry.row.code}">{entry.row.name}</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<form class="filters" method="get" onsubmit={(event) => event.preventDefault()}>
	<label>
		<span>Region</span>
		<select name="region" value={data.region ?? ''} onchange={choose}>
			<option value="">All regions</option>
			{#each data.regions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</label>
	<noscript><button type="submit">Show</button></noscript>
</form>

{#if data.rows.length === 0}
	<EmptyState title="Nothing to show yet.">
		No championship has teams or upcoming qualifiers listed for this region. It updates as events
		finish.
	</EmptyState>
{:else}
	<section aria-labelledby="regional-title">
		<div class="head">
			<h2 class="sec-title" id="regional-title">Regional championships</h2>
			<p class="muted summary">
				{integer(advanced)}
				{advanced === 1 ? 'team' : 'teams'} advanced, {integer(ahead)}
				{ahead === 1 ? 'event' : 'events'} still to play.
			</p>
		</div>
		{#if regional.length > 0}
			<ChampionshipTable
				caption="Regional championships"
				rows={regional}
				{followed}
				region={data.region}
			/>
		{:else}
			<p class="muted">No regional championship listed for this region.</p>
		{/if}
	</section>

	{#if world.length > 0}
		<section aria-labelledby="world-title">
			<div class="head">
				<h2 class="sec-title" id="world-title">FIRST Championship</h2>
				<p class="muted summary">
					Regional championships send teams on. FIRST posts each region's spots starting in early
					December.
				</p>
			</div>
			<ChampionshipTable
				caption="FIRST Championship"
				rows={world}
				{followed}
				region={data.region}
			/>
		</section>
	{/if}
{/if}

{#if data.region && data.unassigned.length > 0}
	<section aria-labelledby="unassigned-title">
		<h2 class="sec-title" id="unassigned-title">Destination not posted yet</h2>
		<ul class="plain">
			{#each data.unassigned as event (event.code)}
				<li>
					<a href="/events/{event.code}">{event.name}</a>
					<span class="faint">
						{typeLabel(event.type)} · {shortRange(event.start, event.end)}{isAhead(event)
							? ''
							: ' · played, results not in yet'}
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<p class="note">
	Teams advance on advancement points from their first three qualifiers or league tournaments in
	their home region. Points come from qualification rank, alliance selection, playoff finish and
	judged awards, and an Inspire Award win is worth the most. Each region sets its own spots per
	event and FIRST doesn't publish a total per championship, so spots left can't be counted. Lists
	fill in as finished events load, and destinations for events that haven't played are inferred from
	their region.
</p>

<style>
	section {
		display: grid;
		gap: 10px;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 14px;
	}

	.summary {
		font-size: 14px;
	}

	.yours ul,
	.plain {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 14px;
	}

	.yours li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}

	.plain .faint {
		margin-left: 6px;
		font-size: 13px;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: end;
	}

	.filters label {
		display: grid;
		gap: 4px;
		font-size: 13px;
		color: var(--text-2);
	}

	select {
		min-width: 240px;
	}

	@media (max-width: 600px) {
		.filters label,
		select {
			width: 100%;
			min-width: 0;
		}
	}
</style>
