<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { typeLabel } from '#lib/components/event/event-meta.ts';
	import {
		filterEvents,
		groupByWeek,
		typeOptions,
		unpackEvents,
		type DateFilter
	} from '#lib/components/event/event-list.ts';
	import { integer } from '#lib/format/number.ts';
	import { shortRange } from '#lib/format/time.ts';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { SEASON_NAME, siteTitle } from '#lib/seo.ts';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import type { PageProps } from './$types';

	const PAGE_SIZE = 200;
	const WHEN: { value: DateFilter; label: string }[] = [
		{ value: 'week', label: 'This week' },
		{ value: 'upcoming', label: 'Upcoming' },
		{ value: 'past', label: 'Past' },
		{ value: 'all', label: 'All' }
	];
	const STATUS = { live: 'Live', upcoming: 'Upcoming', done: 'Done' } as const;

	let { data }: PageProps = $props();

	const renderedAt = () => data.renderedAt;

	let now = $state(renderedAt());
	let query = $state('');
	let region = $state('');
	let type = $state('');
	let when = $state<DateFilter>('upcoming');
	let limit = $state(PAGE_SIZE);
	let ready = false;

	const events = $derived(unpackEvents(data.events));
	const types = $derived(typeOptions(events));
	const filters = $derived({ query, region, type, when });
	const finished = $derived(new Set(data.finished));
	const shown = $derived(filterEvents(events, filters, now, finished));
	const groups = $derived(groupByWeek(shown.slice(0, limit), now));
	const elsewhere = $derived(
		shown.length === 0 && when !== 'all'
			? filterEvents(events, { ...filters, when: 'all' }, now, finished).length
			: 0
	);

	$effect(() => {
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		const params = page.url.searchParams;
		untrack(() => {
			query = params.get('q') ?? '';
			region = params.get('region') ?? '';
			type = params.get('type') ?? '';
			const chosen = params.get('when');
			when = WHEN.some((option) => option.value === chosen) ? (chosen as DateFilter) : 'upcoming';
			ready = true;
		});
	});

	$effect(() => {
		const next = { q: query.trim(), region, type, when: when === 'upcoming' ? '' : when };
		if (!ready) return;
		untrack(() => {
			const url = new URL(page.url.href);
			for (const [key, value] of Object.entries(next)) {
				if (value) url.searchParams.set(key, value);
				else url.searchParams.delete(key);
			}
			if (url.search !== page.url.search) goto(url, { shallow: true, replace: true });
		});
	});

	$effect(() => {
		void filters;
		limit = PAGE_SIZE;
	});

	function reset() {
		query = '';
		region = '';
		type = '';
		when = 'all';
	}
</script>

<Seo
	title={siteTitle(`FTC events, ${SEASON_NAME} season`)}
	description="All {integer(
		events.length
	)} FTC events in the {SEASON_NAME} season: qualifiers, league meets, championships and more, with live rankings, schedules, results and awards."
	path="/events"
/>

<PageHeader
	title="Events"
	meta="{integer(events.length)} events in the BIOBUZZ season."
	status={data.stale ? staleLine : undefined}
/>

{#snippet staleLine()}
	The event list couldn't be refreshed. <StaleNotice
		updated={data.fetchedAt}
		prefix="Last updated"
	/>.
{/snippet}

<form class="filters" role="search" onsubmit={(event) => event.preventDefault()}>
	<label class="search">
		<span class="visually-hidden">Search events</span>
		<input
			type="search"
			placeholder="Search by name, code or city"
			autocomplete="off"
			spellcheck="false"
			bind:value={query}
		/>
	</label>
	<label>
		<span class="visually-hidden">Region</span>
		<select bind:value={region}>
			<option value="">All regions</option>
			{#each data.regions as group (group.label)}
				<optgroup label={group.label}>
					{#each group.options as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
	</label>
	<label>
		<span class="visually-hidden">Event type</span>
		<select bind:value={type}>
			<option value="">All types</option>
			{#each types as option (option)}
				<option value={option}>{typeLabel(option)}</option>
			{/each}
		</select>
	</label>
	<div class="seg" role="group" aria-label="Dates">
		{#each WHEN as option (option.value)}
			<button
				type="button"
				aria-pressed={when === option.value}
				onclick={() => (when = option.value)}
			>
				{option.label}
			</button>
		{/each}
	</div>
</form>

{#if shown.length === 0}
	<EmptyState title="No events match.">
		{#if elsewhere > 0}
			{integer(elsewhere)}
			{elsewhere === 1 ? 'event matches' : 'events match'} on other dates.
			<button type="button" class="link" onclick={() => (when = 'all')}>Show all dates</button>
		{:else}
			<button type="button" class="link" onclick={reset}>Clear the filters</button>
		{/if}
	</EmptyState>
{:else}
	<p class="count">{integer(shown.length)} {shown.length === 1 ? 'event' : 'events'}</p>
	<div class="table-wrap">
		<table class="t events">
			<caption class="visually-hidden">Events</caption>
			<thead>
				<tr>
					<th class="l" scope="col">Event</th>
					<th class="l type" scope="col">Type</th>
					<th class="l place" scope="col">Location</th>
					<th class="l" scope="col">Dates</th>
					<th class="teams" scope="col">Teams</th>
					<th class="l" scope="col">Status</th>
				</tr>
			</thead>
			{#each groups as group (group.start)}
				<tbody>
					<tr class="week">
						<th class="l" colspan="6" scope="rowgroup">
							{#if group.current}
								<span class="now">This week</span>
								<span class="muted">{group.label}</span>
							{:else}
								{group.label}
							{/if}
						</th>
					</tr>
					{#each group.events as event (event.code)}
						<tr>
							<td class="l name">
								<a href="/events/{event.code}">{event.name}</a>
								<span class="sub">{event.place ?? ''}</span>
							</td>
							<td class="l type muted">{typeLabel(event.type)}</td>
							<td class="l place muted">{event.place ?? ''}</td>
							<td class="l">{shortRange(event.start, event.end)}</td>
							<td class="teams">{event.teams ?? '—'}</td>
							<td class={['l', 'status', event.status]}>{STATUS[event.status]}</td>
						</tr>
					{/each}
				</tbody>
			{/each}
		</table>
	</div>
	{#if shown.length > limit}
		<div>
			<Button variant="secondary" onclick={() => (limit += PAGE_SIZE * 2)}>Show more events</Button>
		</div>
	{/if}
{/if}

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}

	.search {
		flex: 1 1 260px;
	}

	input,
	select {
		width: 100%;
		min-width: 0;
	}

	input {
		padding: 7px 10px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		font-size: 14px;
		line-height: 1.4;
	}

	select {
		max-width: 260px;
	}

	input::placeholder {
		color: var(--text-3);
	}

	.seg {
		display: inline-flex;
		flex: none;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		overflow: hidden;
	}

	.seg button {
		min-height: calc(var(--control-h) - 2px);
		padding: 8px 12px;
		border: 0;
		background: transparent;
		color: var(--text-2);
		font: 500 13px/1 var(--font);
	}

	.seg button + button {
		border-left: 1px solid var(--line-2);
	}

	.seg button:hover {
		color: var(--text);
	}

	.seg button[aria-pressed='true'] {
		background: var(--surface);
		color: var(--text);
	}

	.seg button:focus-visible {
		outline-offset: -2px;
	}

	.count {
		margin-bottom: -12px;
		font-size: 14px;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.events td {
		padding-block: 8px;
	}

	.week th {
		padding-top: 20px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
		text-align: left;
	}

	tbody:first-of-type .week th {
		padding-top: 12px;
	}

	.now {
		margin-right: 6px;
	}

	.name {
		white-space: normal;
		min-width: 220px;
	}

	.name a {
		font-weight: 500;
	}

	.sub {
		display: none;
		font-size: 13px;
		color: var(--text-2);
	}

	.status.live {
		color: var(--text);
		font-weight: 600;
	}

	.status.upcoming {
		color: var(--text-2);
	}

	.status.done {
		color: var(--text-3);
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--text);
		font: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
		text-decoration-thickness: 1px;
	}

	@media (max-width: 900px) {
		.type,
		.teams {
			display: none;
		}
	}

	@media (max-width: 760px) {
		.place {
			display: none;
		}

		.sub {
			display: block;
		}

		.name {
			min-width: 0;
		}

		select {
			max-width: none;
		}

		.filters label:not(.search) {
			flex: 1 1 140px;
		}
	}
	@media (pointer: coarse) {
		input,
		.seg button {
			min-height: 40px;
		}
	}
</style>
