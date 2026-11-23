<script lang="ts">
	import { goto } from '$app/navigation';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import FilterPanel from '#lib/ui/FilterPanel.svelte';
	import {
		RECORD_PARTS,
		RECORD_RANGES,
		recordSummary,
		type RecordFilters,
		type RecordOption
	} from './records.ts';

	interface Props {
		filters: RecordFilters;
		regions: RecordOption[];
		types: RecordOption[];
		empty?: boolean;
	}

	let { filters, regions, types, empty = false }: Props = $props();

	const active = $derived(
		Boolean(
			filters.range !== 'all' || filters.region || filters.type || filters.level || filters.team
		)
	);
	const summary = $derived(recordSummary(filters, { regions, types }));
	const clearHref = $derived(
		filters.part === 'total' ? '/records' : `/records?part=${filters.part}`
	);

	function apply(event: Event) {
		event.preventDefault();
		const params = new SvelteURLSearchParams();
		for (const [key, value] of new FormData(event.currentTarget as HTMLFormElement)) {
			if (typeof value === 'string' && value.trim() !== '') params.set(key, value.trim());
		}
		if (params.get('range') === 'all') params.delete('range');
		if (params.get('part') === 'total') params.delete('part');
		goto(params.size > 0 ? `?${params}` : '?', { reset: false });
	}
</script>

<form class="filters" method="get" onchange={apply} onsubmit={apply}>
	<FilterPanel {summary}>
		<label>
			<span>Dates</span>
			<select name="range" value={filters.range}>
				{#each RECORD_RANGES as range (range.key)}
					<option value={range.key}>{range.label}</option>
				{/each}
			</select>
		</label>
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
			<span>Event type</span>
			<select name="type" value={filters.type}>
				<option value="">All types</option>
				{#each types as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Matches</span>
			<select name="level" value={filters.level}>
				<option value="">Quals and playoffs</option>
				<option value="qual">Quals only</option>
				<option value="playoff">Playoffs only</option>
			</select>
		</label>
		<label>
			<span>Team</span>
			<input
				name="team"
				type="text"
				inputmode="numeric"
				pattern="[0-9]*"
				maxlength="6"
				placeholder="Team number"
				autocomplete="off"
				value={filters.team ?? ''}
			/>
		</label>
		<label class="sort">
			<span>Sort by</span>
			<select name="part" value={filters.part}>
				{#each RECORD_PARTS as part (part.key)}
					<option value={part.key}>{part.label}</option>
				{/each}
			</select>
		</label>
		<noscript><button type="submit">Apply</button></noscript>
		{#if active && !empty}
			<a class="clear" href={clearHref}>Clear filters</a>
		{/if}
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
	}

	input {
		width: 128px;
		padding: 7px 10px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
		line-height: 1.4;
		font-variant-numeric: tabular-nums;
	}

	input:hover {
		border-color: var(--text-3);
	}

	.sort {
		display: none;
	}

	.clear {
		padding-block: 8px;
		font-size: 13px;
		color: var(--text-2);
	}

	@media (max-width: 900px) {
		.sort {
			display: grid;
		}
	}

	@media (max-width: 600px) {
		label {
			flex: 1 1 140px;
		}

		select,
		input {
			min-width: 0;
			width: 100%;
		}
	}

	@media (pointer: coarse) {
		input,
		.clear {
			min-height: 40px;
		}

		.clear {
			display: inline-flex;
			align-items: center;
			padding-block: 0;
		}
	}
</style>
