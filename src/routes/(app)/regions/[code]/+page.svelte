<script lang="ts">
	import { page } from '$app/state';
	import ChampionshipTable from '#lib/components/advancement/ChampionshipTable.svelte';
	import { watchFollows } from '#lib/components/follow/follow.svelte.ts';
	import RegionEvents from '#lib/components/region/RegionEvents.svelte';
	import RegionTeams from '#lib/components/region/RegionTeams.svelte';
	import { integer } from '#lib/format/number.ts';
	import { shortDate } from '#lib/format/time.ts';
	import { breadcrumbs, regionDescription, regionTitle } from '#lib/seo.ts';
	import AllianceChip from '#lib/ui/AllianceChip.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import '#lib/ui/score-table.css';
	import type { PageProps } from './$types';

	type Shown = 'upcoming' | 'done';

	let { data }: PageProps = $props();

	let followed = $state<ReadonlySet<number>>(new Set());
	let picked = $state<Shown | null>(null);

	$effect(() => watchFollows((teams) => (followed = new Set(teams))));

	const region = $derived(data.summary);
	const code = $derived(region.code);
	const shown = $derived<Shown>(
		picked ??
			(data.events.upcoming.length > 0 || data.events.done.length === 0 ? 'upcoming' : 'done')
	);
	const listed = $derived(shown === 'upcoming' ? data.events.upcoming : data.events.done);
	const choices = $derived([
		{ value: 'upcoming' as const, label: `Upcoming ${integer(data.events.upcoming.length)}` },
		{ value: 'done' as const, label: `Finished ${integer(data.events.done.length)}` }
	]);
	const seo = $derived({
		title: regionTitle(region.name),
		description: regionDescription(region),
		path: `/regions/${code}`,
		data: [
			breadcrumbs(page.url.origin, [
				{ name: 'PitStop', path: '/' },
				{ name: 'Regions', path: '/regions' },
				{ name: region.name, path: `/regions/${code}` }
			])
		]
	});
</script>

<Seo {...seo} />

<p class="crumb"><a href="/regions">Regions</a></p>

<PageHeader title={region.name}>
	{#snippet status()}
		{#if data.updated}
			<StaleNotice updated={data.updated} staleAfter={86400} prefix="Ratings updated" />.
		{/if}
		<a href="/events/strength?region={code}">Event strength</a>
	{/snippet}
</PageHeader>

<section aria-labelledby="teams-title">
	<div class="head">
		<h2 class="sec-title" id="teams-title">Top teams</h2>
		{#if region.rated > 0}
			<a href="/leaderboards?region={code}">All {integer(region.rated)} rated teams</a>
		{/if}
	</div>
	{#if data.teams.length === 0}
		<EmptyState title="No rated teams yet." />
	{:else}
		<RegionTeams
			teams={data.teams}
			{followed}
			caption="Top teams in {region.name} by season aOPR"
		/>
	{/if}
</section>

<section aria-labelledby="events-title">
	<div class="head">
		<h2 class="sec-title" id="events-title">Events</h2>
		<a href="/events?region={code}">All events in {region.name}</a>
	</div>
	{#if data.events.live.length > 0}
		<h3 class="group">Today</h3>
		<RegionEvents events={data.events.live} caption="Events today in {region.name}" />
	{/if}
	{#if data.events.upcoming.length + data.events.done.length > 0}
		<div class="pick">
			<Segmented
				label="Which events"
				options={choices}
				value={shown}
				onselect={(next) => (picked = next)}
			/>
		</div>
		{#if listed.length === 0}
			<p class="muted empty">
				{shown === 'upcoming' ? 'No more events this season.' : 'No events have finished yet.'}
			</p>
		{:else}
			<RegionEvents
				events={listed}
				caption={shown === 'upcoming'
					? `Upcoming events in ${region.name}`
					: `Finished events in ${region.name}`}
			/>
		{/if}
	{/if}
</section>

<section aria-labelledby="advancement-title">
	<div class="head">
		<h2 class="sec-title" id="advancement-title">Advancement</h2>
		{#if data.advancement && data.advancement.rows.length > 0}
			<a href="/advancement?region={code}">Advancement for {region.name}</a>
		{/if}
	</div>
	{#if !data.advancement}
		<p class="muted">Advancement is still loading. Check back in a minute.</p>
	{:else if data.advancement.rows.length === 0}
		<p class="muted">No championship lists events from this region yet.</p>
	{:else}
		<ChampionshipTable
			caption="Championships {region.name} teams advance to"
			rows={data.advancement.rows}
			{followed}
			region={code}
		/>
	{/if}
	{#if data.advancement && data.advancement.unassigned.length > 0}
		<p class="faint small">
			{integer(data.advancement.unassigned.length)}
			{data.advancement.unassigned.length === 1 ? 'event has' : 'events have'} not posted which championship
			{data.advancement.unassigned.length === 1 ? 'it feeds' : 'they feed'}.
		</p>
	{/if}
</section>

<section aria-labelledby="scores-title">
	<div class="head">
		<h2 class="sec-title" id="scores-title">Best scores</h2>
		{#if data.records && data.records.length > 0}
			<a href="/records?region={code}">All records in {region.name}</a>
		{/if}
	</div>
	{#if !data.records}
		<p class="muted">Season scores are still loading. Check back in a minute.</p>
	{:else if data.records.length === 0}
		<p class="muted">No matches played in this region yet.</p>
	{:else}
		<div class="score-table best">
			<table>
				<caption class="visually-hidden">Highest alliance scores in {region.name}</caption>
				<thead>
					<tr>
						<th scope="col" class="side">Alliance</th>
						<th scope="col">Teams</th>
						<th scope="col" class="event-col">Match</th>
						<th scope="col" class="right score">Score</th>
					</tr>
				</thead>
				<tbody>
					{#each data.records as row (`${row.event}:${row.key}:${row.alliance}`)}
						<tr class={{ me: row.teams.some((team) => followed.has(team)) }}>
							<td><AllianceChip alliance={row.alliance} /></td>
							<td>
								<div class="teams">
									{#each row.teams as team (team)}
										<a class="team" href="/teams/{team}">
											<b>{team}</b>
											{#if data.names.teams[team]}
												<span class="name">{data.names.teams[team]}</span>
											{/if}
										</a>
									{/each}
								</div>
								<a class="match phone" href="/events/{row.event}/matches/{row.key}">
									{row.label} at {data.names.events[row.event] ?? row.event}
								</a>
							</td>
							<td class="event-col">
								<a class="match" href="/events/{row.event}/matches/{row.key}">
									{row.label}
									<span class="faint">{shortDate(row.day)}</span>
								</a>
								<a class="event" href="/events/{row.event}">
									{data.names.events[row.event] ?? row.event}
								</a>
							</td>
							<td class="v">{integer(row.total)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<style>
	.crumb {
		margin-bottom: -14px;
		font-size: 14px;
		color: var(--text-2);
	}

	.crumb a {
		text-decoration: none;
	}

	.crumb a:hover {
		text-decoration: underline;
	}

	section {
		display: grid;
		gap: 10px;
		min-width: 0;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 4px 14px;
		font-size: 14px;
	}

	.pick {
		display: flex;
	}

	.group {
		margin-top: 4px;
		font-size: 13px;
		font-weight: 600;
	}

	.empty,
	.small {
		font-size: 14px;
	}

	.best .teams {
		flex-direction: column;
		gap: 2px;
	}

	.best a {
		text-decoration: none;
	}

	.best a:hover {
		text-decoration: underline;
	}

	.best th.side {
		width: 98px;
	}

	.best th.event-col {
		width: 38%;
	}

	.best th.score {
		width: 102px;
	}

	.best .team {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.best .event,
	.best .match {
		display: block;
		overflow: hidden;
		font-size: 14px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.best .match {
		font-weight: 600;
	}

	.best .event {
		color: var(--text-2);
	}

	.best .name {
		margin-left: 4px;
		white-space: nowrap;
	}

	.best .phone {
		display: none;
	}

	.best tr.me td {
		background: var(--accent-wash);
	}

	@media (max-width: 760px) {
		.best .event-col {
			display: none;
		}

		.best .phone {
			display: block;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			margin-top: 4px;
			font-size: 12.5px;
			font-weight: 500;
			color: var(--text-2);
		}

		.best th.side {
			width: 64px;
		}

		.best th.score {
			width: 64px;
		}

		.best .v {
			font-size: 18px;
		}
	}
</style>
