<script lang="ts">
	import { goto } from '$app/navigation';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { MIN_MATCH_CHOICES, type FilterOption, type LeaderboardFilters } from './leaderboard.ts';

	interface Props {
		filters: LeaderboardFilters;
		regions: FilterOption[];
		countries: FilterOption[];
		states: FilterOption[];
	}

	let { filters, regions, countries, states }: Props = $props();

	const minimums = $derived(
		[...new Set([...MIN_MATCH_CHOICES, ...(filters.min > 1 ? [filters.min] : [])])].sort(
			(a, b) => a - b
		)
	);
	const active = $derived(
		Boolean(filters.region || filters.country || filters.state || filters.min > 1)
	);

	function apply(event: Event) {
		event.preventDefault();
		const params = new SvelteURLSearchParams();
		for (const [key, value] of new FormData(event.currentTarget as HTMLFormElement)) {
			if (typeof value === 'string' && value !== '') params.set(key, value);
		}
		if (event.target instanceof HTMLSelectElement && event.target.name === 'country') {
			params.delete('state');
		}
		goto(params.size > 0 ? `?${params}` : '?', { reset: false });
	}
</script>

<form class="filters" method="get" onchange={apply} onsubmit={apply}>
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
	<label>
		<span>Minimum matches</span>
		<select name="min" value={filters.min > 1 ? String(filters.min) : ''}>
			<option value="">Any</option>
			{#each minimums as count (count)}
				<option value={String(count)}>{count}</option>
			{/each}
		</select>
	</label>
	<noscript><button type="submit">Apply</button></noscript>
	{#if active}
		<a class="clear" href="/leaderboards">Clear filters</a>
	{/if}
</form>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 12px 16px;
	}

	label {
		display: grid;
		gap: 4px;
		font-size: 13px;
		color: var(--text-2);
	}

	select {
		min-width: 150px;
		padding: 7px 8px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
	}

	select:disabled {
		color: var(--text-3);
	}

	.clear {
		padding-block: 8px;
		font-size: 13px;
		color: var(--text-2);
	}

	@media (max-width: 600px) {
		label {
			flex: 1 1 140px;
		}

		select {
			min-width: 0;
			width: 100%;
		}
	}
</style>
