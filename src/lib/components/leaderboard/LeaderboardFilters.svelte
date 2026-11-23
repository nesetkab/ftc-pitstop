<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy, untrack } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { addDays } from '#lib/components/event/dates.ts';
	import FilterPanel from '#lib/ui/FilterPanel.svelte';
	import {
		LEADERBOARD_SORTS,
		MIN_MATCH_CHOICES,
		RECENT_DAYS,
		datesChoice,
		filterSummary,
		hasFilters,
		type FilterOption,
		type LeaderboardFilters
	} from './leaderboard.ts';

	interface Props {
		filters: LeaderboardFilters;
		regions: FilterOption[];
		countries: FilterOption[];
		states: FilterOption[];
		types?: FilterOption[];
		weeks?: FilterOption[];
	}

	let { filters, regions, countries, states, types = [], weeks = [] }: Props = $props();

	let customOpen = $state(false);
	const chosen = $derived(datesChoice(filters, weeks));
	const custom = $derived(customOpen || chosen === 'custom');

	let timer: ReturnType<typeof setTimeout> | undefined;
	let sent = untrack(() => filters.q);
	let query = $state(untrack(() => filters.q));

	$effect.pre(() => {
		if (filters.q !== sent) {
			query = filters.q;
			sent = filters.q;
		}
	});

	const summary = $derived(filterSummary(filters, { regions, countries, states, types }));
	const minimums = $derived(
		[...new Set([...MIN_MATCH_CHOICES, ...(filters.min > 1 ? [filters.min] : [])])].sort(
			(a, b) => a - b
		)
	);
	const active = $derived(hasFilters(filters));

	$effect.pre(() => {
		if (!active) untrack(() => (customOpen = false));
	});

	function pickDates(params: URLSearchParams, choice: string): boolean {
		params.delete('dates');
		params.delete('from');
		params.delete('to');
		customOpen = choice === 'custom';
		if (choice === 'custom') return false;
		if (choice === 'recent') params.set('dates', 'recent');
		else if (choice) {
			params.set('from', choice);
			params.set('to', addDays(choice, 6));
		}
		return true;
	}

	function navigate(form: HTMLFormElement, target: EventTarget | null) {
		clearTimeout(timer);
		const params = new SvelteURLSearchParams();
		for (const [key, value] of new FormData(form)) {
			if (typeof value === 'string' && value.trim() !== '') params.set(key, value.trim());
		}
		if (target instanceof HTMLSelectElement && target.name === 'country') params.delete('state');
		if (target instanceof HTMLSelectElement && target.dataset.dates !== undefined) {
			if (!pickDates(params, target.value)) return;
		}
		if (params.get('sort') === 'opr') params.delete('sort');
		sent = params.get('q') ?? '';
		const options =
			target instanceof HTMLInputElement ? { reset: false, replace: true } : { reset: false };
		goto(params.size > 0 ? `?${params}` : '?', options);
	}

	function apply(event: Event) {
		event.preventDefault();
		navigate(event.currentTarget as HTMLFormElement, event.target);
	}

	function typed(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (input.form) navigate(input.form, input);
		}, 300);
	}

	onDestroy(() => clearTimeout(timer));
</script>

<form class="filters" method="get" role="search" onchange={apply} onsubmit={apply}>
	<FilterPanel {summary}>
		{#snippet search()}
			<label class="find">
				<span>Find a team</span>
				<input
					name="q"
					type="search"
					placeholder="Name, number or city"
					autocomplete="off"
					maxlength="40"
					bind:value={query}
					oninput={typed}
				/>
			</label>
		{/snippet}
		<label>
			<span>Region</span>
			<select name="region" value={filters.region}>
				<option value="">All regions</option>
				{#each regions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Country</span>
			<select name="country" value={filters.country}>
				<option value="">All countries</option>
				{#each countries as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>State or province</span>
			<select name="state" value={filters.state} disabled={!filters.country}>
				<option value="">All</option>
				{#each states as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
		{#if types.length > 0}
			<label>
				<span>Event type</span>
				<select name="type" value={filters.type}>
					<option value="">All events</option>
					{#each types as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Dates</span>
				<select data-dates value={custom ? 'custom' : chosen}>
					<option value="">All season</option>
					<option value="recent">Last {RECENT_DAYS / 7} weeks</option>
					{#if weeks.length > 0}
						<optgroup label="Week of">
							{#each weeks as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</optgroup>
					{/if}
					<option value="custom">Custom range</option>
				</select>
			</label>
			{#if custom}
				<label>
					<span>From</span>
					<input
						class="date"
						name="from"
						type="date"
						value={filters.from}
						max={filters.to || undefined}
					/>
				</label>
				<label>
					<span>To</span>
					<input
						class="date"
						name="to"
						type="date"
						value={filters.to}
						min={filters.from || undefined}
					/>
				</label>
			{:else if filters.dates}
				<input type="hidden" name="dates" value={filters.dates} />
			{:else}
				{#if filters.from}<input type="hidden" name="from" value={filters.from} />{/if}
				{#if filters.to}<input type="hidden" name="to" value={filters.to} />{/if}
			{/if}
		{/if}
		<label>
			<span>Minimum matches</span>
			<select name="min" value={filters.min > 1 ? String(filters.min) : ''}>
				<option value="">Any</option>
				{#each minimums as count (count)}
					<option value={String(count)}>{count}</option>
				{/each}
			</select>
		</label>
		<label class="sort">
			<span>Sort by</span>
			<select name="sort" value={filters.sort}>
				{#each LEADERBOARD_SORTS as sort (sort.key)}
					<option value={sort.key}>{sort.label}</option>
				{/each}
			</select>
		</label>
		{#if filters.team > 0}
			<input type="hidden" name="team" value={filters.team} />
		{/if}
		<noscript><button type="submit">Apply</button></noscript>
	</FilterPanel>
</form>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 12px;
	}

	label {
		display: grid;
		gap: 4px;
		font-size: 13px;
		color: var(--text-2);
	}

	select {
		min-width: 128px;
		max-width: 180px;
	}

	.find {
		flex: 1 0 160px;
	}

	input {
		width: 100%;
		padding: 7px 10px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
		line-height: 1.4;
	}

	input:hover {
		border-color: var(--text-3);
	}

	.date {
		width: 150px;
		padding-block: 6px;
	}

	.sort {
		display: none;
	}

	@media (max-width: 640px) {
		.sort {
			display: grid;
		}
	}

	@media (max-width: 600px) {
		label {
			flex: 1 1 140px;
		}

		.find {
			flex-basis: 100%;
		}

		select,
		input,
		.date {
			min-width: 0;
			max-width: none;
			width: 100%;
		}
	}

	@media (max-width: 640px) and (scripting: enabled) {
		.find span {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}

	@media (pointer: coarse) {
		input {
			min-height: 40px;
		}
	}
</style>
