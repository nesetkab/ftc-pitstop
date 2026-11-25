<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import EventSections from '#lib/components/event/EventSections.svelte';
	import { typeLabel } from '#lib/components/event/event-meta.ts';
	import { typeOptions, unpackEvents } from '#lib/components/event/event-list.ts';
	import {
		DEEP,
		filterStrength,
		strengthRows,
		TOP,
		type StrengthBy,
		type StrengthWhen
	} from '#lib/components/event/strength.ts';
	import { fixed, integer } from '#lib/format/number.ts';
	import { shortRange } from '#lib/format/time.ts';
	import { SEASON_NAME, siteTitle } from '#lib/seo.ts';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FilterPanel from '#lib/ui/FilterPanel.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import Term from '#lib/ui/Term.svelte';
	import type { PageProps } from './$types';

	const PAGE_SIZE = 100;
	const WHEN: { value: StrengthWhen; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'upcoming', label: 'Upcoming' },
		{ value: 'past', label: 'Past' }
	];
	const BY: { value: StrengthBy; label: string }[] = [
		{ value: 'top', label: `Top ${TOP}` },
		{ value: 'deep', label: `Top ${DEEP}` },
		{ value: 'all', label: 'Field' }
	];

	let { data }: PageProps = $props();

	const renderedAt = () => data.renderedAt;

	let now = $state(renderedAt());
	let region = $state('');
	let type = $state('');
	let when = $state<StrengthWhen>('all');
	let by = $state<StrengthBy>('top');
	let limit = $state(PAGE_SIZE);
	let ready = false;

	const events = $derived(unpackEvents(data.events));
	const rows = $derived(strengthRows(events, data.details));
	const types = $derived(typeOptions(events));
	const filters = $derived({ region, type, when, by });
	const shown = $derived(filterStrength(rows, filters, now));
	const filtered = $derived(region !== '' || type !== '' || when !== 'all');
	const regionLabel = $derived(
		data.regions.flatMap((group) => group.options).find((option) => option.value === region)
			?.label ?? ''
	);
	const chosenType = $derived(types.find((option) => option === type));
	const summary = $derived(
		[
			region ? regionLabel : '',
			chosenType ? typeLabel(chosenType) : '',
			when === 'all' ? '' : (WHEN.find((option) => option.value === when)?.label ?? ''),
			by === 'top'
				? ''
				: `Ranked by ${BY.find((option) => option.value === by)?.label.toLowerCase()}`
		].filter(Boolean)
	);
	const meta = $derived(`Events ranked by the average season aOPR of their ${TOP} best teams.`);

	$effect(() => {
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(timer);
	});

	$effect(() => {
		const params = page.url.searchParams;
		untrack(() => {
			region = params.get('region') ?? '';
			type = params.get('type') ?? '';
			const chosen = params.get('when');
			when = WHEN.some((option) => option.value === chosen) ? (chosen as StrengthWhen) : 'all';
			const order = params.get('by');
			by = BY.some((option) => option.value === order) ? (order as StrengthBy) : 'top';
			ready = true;
		});
	});

	$effect(() => {
		const next = {
			region,
			type,
			when: when === 'all' ? '' : when,
			by: by === 'top' ? '' : by
		};
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
		region = '';
		type = '';
		when = 'all';
	}
</script>

<Seo
	title={siteTitle(`Strongest FTC events, ${SEASON_NAME} season`)}
	description="Every FTC event in the {SEASON_NAME} season ranked by strength: the average season aOPR of its {TOP} best teams. Filter by region, event type and date."
	path="/events/strength"
/>

<EventSections />

<PageHeader title="Event strength" {meta}>
	{#snippet status()}
		{#if data.updated}
			<StaleNotice updated={data.updated} staleAfter={86400} prefix="Ratings updated" />.
		{/if}
		<a href="/about#event-strength">How strength works</a>
	{/snippet}
</PageHeader>

{#if rows.length === 0}
	<EmptyState title="Event strength isn’t ready yet.">
		It is worked out from season ratings, which are still loading. Try again in a few minutes.
	</EmptyState>
{:else}
	<form class="filters" onsubmit={(event) => event.preventDefault()}>
		<FilterPanel {summary}>
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
			<Segmented label="Dates" options={WHEN} value={when} onselect={(value) => (when = value)} />
			<Segmented label="Rank by" options={BY} value={by} onselect={(value) => (by = value)} />
		</FilterPanel>
	</form>

	{#if shown.length === 0}
		<EmptyState title="No events match.">
			{#if by === 'deep'}
				Only events with {DEEP} or more rated teams have a top {DEEP} average.
			{/if}
			<button type="button" class="link" onclick={reset}>Clear filters</button>
		</EmptyState>
	{:else}
		<p class="count">
			{integer(shown.length)}
			{shown.length === 1 ? 'event' : 'events'}{filtered ? ' match' : ''}
		</p>
		<div class="table-wrap">
			<table class="t ranked">
				<caption class="visually-hidden">Events ranked by strength</caption>
				<thead>
					<tr>
						<th scope="col"><Term label="#" /></th>
						<th class="l" scope="col">Event</th>
						<th class="l type" scope="col">Type</th>
						<th class="l opt" scope="col">Dates</th>
						<th class="opt" scope="col"><Term label="Rated" /></th>
						<th
							class={{ on: by === 'top' }}
							scope="col"
							aria-sort={by === 'top' ? 'descending' : undefined}><Term label="Strength" /></th
						>
						<th
							class={{ on: by === 'deep', opt: by !== 'deep' }}
							scope="col"
							aria-sort={by === 'deep' ? 'descending' : undefined}><Term label="Top 24" /></th
						>
						<th
							class={{ on: by === 'all', opt: by !== 'all' }}
							scope="col"
							aria-sort={by === 'all' ? 'descending' : undefined}><Term label="Field avg" /></th
						>
					</tr>
				</thead>
				<tbody>
					{#each shown.slice(0, limit) as row, at (row.code)}
						<tr>
							<td class="rank muted">{at + 1}</td>
							<td class="l name">
								<a href="/events/{row.code}">{row.name}</a>
								<span class="sub">
									{row.place ?? ''}<span class="when"
										>{row.place ? ' · ' : ''}{shortRange(row.start, row.end)}</span
									>
								</span>
							</td>
							<td class="l type muted">{typeLabel(row.type)}</td>
							<td class="l opt">{shortRange(row.start, row.end)}</td>
							<td class="opt muted">{row.rated} of {row.teams ?? row.rated}</td>
							<td class={{ on: by === 'top' }}>{fixed(row.top)}</td>
							<td class={{ on: by === 'deep', opt: by !== 'deep' }}>{fixed(row.deep)}</td>
							<td class={{ on: by === 'all', opt: by !== 'all' }}>{fixed(row.all)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if shown.length > limit}
			<div>
				<Button variant="secondary" onclick={() => (limit += PAGE_SIZE * 2)}
					>Show more events</Button
				>
			</div>
		{/if}
	{/if}
{/if}

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}

	select {
		width: 100%;
		min-width: 0;
		max-width: 260px;
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

	.ranked td {
		padding-block: 8px;
	}

	.ranked th {
		white-space: nowrap;
	}

	.rank {
		width: 1%;
	}

	.name {
		white-space: normal;
		min-width: 220px;
	}

	.name a {
		font-weight: 500;
	}

	.sub {
		display: block;
		font-size: 13px;
		color: var(--text-2);
	}

	.when {
		display: none;
	}

	th.on {
		color: var(--text);
	}

	td.on {
		font-weight: 600;
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
		.type {
			display: none;
		}
	}

	@media (max-width: 600px) {
		.when {
			display: inline;
		}

		.name {
			min-width: 0;
		}

		select {
			max-width: none;
		}

		.filters label {
			flex: 1 1 140px;
		}
	}
</style>
