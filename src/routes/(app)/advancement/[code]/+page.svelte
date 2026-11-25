<script lang="ts">
	import Brand from '#lib/ui/Brand.svelte';
	import type { Feeder } from '#lib/components/advancement/advancement.ts';
	import { watchFollows } from '#lib/components/follow/follow.svelte.ts';
	import { typeLabel, typeNoun } from '#lib/components/event/event-meta.ts';
	import { integer } from '#lib/format/number.ts';
	import { regionName } from '#lib/format/places.ts';
	import { dateRange, shortRange } from '#lib/format/time.ts';
	import { siteTitle } from '#lib/seo.ts';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import type { PageProps } from './$types';

	const STATE = { upcoming: 'Upcoming', live: 'Today' } as const;

	let { data }: PageProps = $props();

	let followed = $state<ReadonlySet<number>>(new Set());

	$effect(() => watchFollows((teams) => (followed = new Set(teams))));

	const champ = $derived(data.championship);
	const ahead = $derived(
		champ.feeders.filter((feeder) => feeder.state === 'upcoming' || feeder.state === 'live')
	);
	const played = $derived(
		champ.feeders.filter((feeder) => feeder.state === 'done' || feeder.state === 'pending')
	);
	const posted = $derived(played.filter((feeder) => feeder.state === 'done').length);
	const where = $derived(data.region ? regionName(data.region) : null);
	const meta = $derived.by(() => {
		const noun = champ.type ? typeNoun(champ.type) : null;
		const place = champ.place && champ.place !== noun ? champ.place : null;
		const kind = noun && place ? `${noun} in ${place}` : (noun ?? place);
		const when = champ.start && champ.end ? dateRange(champ.start, champ.end) : null;
		return [kind, when]
			.filter(Boolean)
			.map((part) => `${part}.`)
			.join(' ');
	});
	const tracked = $derived(new Set(data.tracked));

	function feederHref(event: Feeder): string {
		return tracked.has(event.code) ? `/advancement/${event.code}` : `/events/${event.code}`;
	}

	const query = $derived(data.region ? `?region=${data.region}` : '');
</script>

<Seo
	title={siteTitle(`Who has advanced to the ${champ.name}`)}
	description="FTC teams advanced to the {champ.name} so far, the event and awards that sent each one, and the {ahead.length} qualifying {ahead.length ===
	1
		? 'event'
		: 'events'} still to play."
	path="/advancement/{champ.code}{query}"
/>

<p class="crumb"><a href="/advancement{query}">Advancement</a></p>

<PageHeader title={champ.name} {meta}>
	{#snippet status()}
		<StaleNotice updated={data.updated} staleAfter={7200} prefix="Updated" />
	{/snippet}
	{#snippet actions()}
		{#if champ.type}
			<Button variant="secondary" href="/events/{champ.code}">Event page</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="summary">
	{#if played.length > posted}
		<p class="muted">
			{integer(played.length - posted)} played {played.length - posted === 1
				? 'event has'
				: 'events have'} no results in yet.
		</p>
	{/if}
	{#if where}
		<p class="muted">
			Showing teams and events from {where}.
			<a href="/advancement/{champ.code}">Show all regions</a>
		</p>
	{/if}
	{#if data.unposted > 0 && champ.region}
		<p class="muted">
			{integer(data.unposted)} more {data.unposted === 1 ? 'event' : 'events'} in {regionName(
				champ.region
			)} haven't posted which championship they feed.
			<a href="/advancement?region={champ.region}">See them</a>
		</p>
	{/if}
	{#if data.next}
		<p class="muted">
			Teams here go on to <a href="/advancement/{data.next.code}"><Brand text={data.next.name} /></a
			>.
		</p>
	{/if}
</div>

<section aria-labelledby="advanced-title">
	<h2 class="sec-title" id="advanced-title">Advanced so far</h2>
	{#if champ.teams.length === 0}
		<EmptyState title="No teams have advanced yet." />
	{:else}
		<div class="table-wrap">
			<table class="t">
				<caption class="visually-hidden">Teams advanced to {champ.name}</caption>
				<thead>
					<tr>
						<th class="l" scope="col">Team</th>
						<th class="l from" scope="col">From</th>
						<th class="l" scope="col">Why</th>
					</tr>
				</thead>
				<tbody>
					{#each champ.teams as team (team.team)}
						<tr class={{ me: followed.has(team.team) }}>
							<td class="l team">
								<TeamCell number={team.team} name={team.name} href="/teams/{team.team}" />
								<a class="sub" href="/events/{team.event}"><Brand text={team.eventName} /></a>
							</td>
							<td class="l from">
								<a href="/events/{team.event}"><Brand text={team.eventName} /></a>
							</td>
							<td class="l why">
								{team.reasons.length > 0 ? team.reasons.join(', ') : 'Advancement points'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

{#if ahead.length > 0}
	<section aria-labelledby="ahead-title">
		<h2 class="sec-title" id="ahead-title">Still to play</h2>
		<div class="table-wrap">
			<table class="t">
				<caption class="visually-hidden">Events still to play</caption>
				<thead>
					<tr>
						<th class="l" scope="col">Event</th>
						<th class="l kind" scope="col">Type</th>
						<th class="l" scope="col">Dates</th>
					</tr>
				</thead>
				<tbody>
					{#each ahead as event (event.code)}
						<tr>
							<td class="l event">
								<a href={feederHref(event)}><Brand text={event.name} /></a>
								{#if event.state === 'live'}
									<span class="live">{STATE.live}</span>
								{/if}
								{#if !event.confirmed}
									<span class="faint expected">Expected</span>
								{/if}
							</td>
							<td class="l kind muted"><Brand text={typeLabel(event.type)} /></td>
							<td class="l">{shortRange(event.start, event.end)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}

{#if played.length > 0}
	<section aria-labelledby="played-title">
		<h2 class="sec-title" id="played-title">Played</h2>
		<div class="table-wrap">
			<table class="t">
				<caption class="visually-hidden">Events already played</caption>
				<thead>
					<tr>
						<th class="l" scope="col">Event</th>
						<th class="l kind" scope="col">Dates</th>
						<th scope="col">Spots</th>
						<th scope="col">Advanced</th>
					</tr>
				</thead>
				<tbody>
					{#each played.toReversed() as event (event.code)}
						<tr>
							<td class="l event">
								<a href={feederHref(event)}><Brand text={event.name} /></a>
								{#if !event.confirmed}
									<span class="faint expected">Expected</span>
								{/if}
							</td>
							<td class="l kind muted">{shortRange(event.start, event.end)}</td>
							{#if event.state === 'pending'}
								<td class="pending faint" colspan="2">Results not in yet</td>
							{:else}
								<td class="n">{event.slots ? integer(event.slots) : '—'}</td>
								<td class="n">{integer(event.advanced)}</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}

{#if champ.feeders.some((feeder) => !feeder.confirmed)}
	<p class="note">
		"Expected" means the event hasn't posted where it sends teams, so PitStop goes by its region.
	</p>
{/if}

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

	.summary {
		display: grid;
		gap: 4px;
		font-size: 14px;
	}

	section {
		display: grid;
		gap: 10px;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.team .sub {
		display: none;
		font-size: 13px;
		color: var(--text-2);
	}

	.why,
	.event {
		white-space: normal;
	}

	.why {
		color: var(--text-2);
	}

	:global(tr.me) .why {
		color: var(--text);
	}

	.expected,
	.live {
		margin-left: 6px;
		font-size: 12.5px;
		white-space: nowrap;
	}

	.live {
		font-weight: 600;
	}

	.pending {
		text-align: right;
	}

	@media (max-width: 760px) {
		.from,
		.kind {
			display: none;
		}

		.team {
			white-space: normal;
		}

		.team .sub {
			display: block;
		}
	}
</style>
