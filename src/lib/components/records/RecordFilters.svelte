<script lang="ts">
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import FilterPanel from '#lib/ui/FilterPanel.svelte';
	import type { SearchFn } from '#lib/ui/search.svelte.ts';
	import TeamInput from '#lib/ui/TeamInput.svelte';
	import {
		conditionParam,
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
		search?: SearchFn;
		delay?: number;
	}

	let { filters, regions, types, search, delay }: Props = $props();

	let form = $state<HTMLFormElement>();
	let team = $derived(filters.team ? String(filters.team) : '');

	async function pickTeam() {
		await tick();
		form?.requestSubmit();
	}

	const summary = $derived(recordSummary(filters, { regions, types }));

	function apply(event: Event) {
		event.preventDefault();
		const params = new SvelteURLSearchParams();
		for (const [key, value] of new FormData(event.currentTarget as HTMLFormElement)) {
			if (typeof value === 'string' && value.trim() !== '') params.append(key, value.trim());
		}
		if (params.get('range') === 'all') params.delete('range');
		if (params.get('part') === 'total') params.delete('part');
		if (params.get('dir') === 'desc') params.delete('dir');
		goto(params.size > 0 ? `?${params}` : '?', { reset: false });
	}
</script>

<form class="filters" method="get" bind:this={form} onchange={apply} onsubmit={apply}>
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
				<option value="">All matches</option>
				<option value="qual">Quals only</option>
				<option value="playoff">Playoffs only</option>
			</select>
		</label>
		<label class="team">
			<span>Team</span>
			<TeamInput
				name="team"
				class="field"
				placeholder="Number or name"
				listLabel="Teams to filter by"
				{search}
				{delay}
				bind:value={team}
				onpick={pickTeam}
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
		<label class="sort">
			<span>Order</span>
			<select name="dir" value={filters.dir}>
				<option value="desc">High to low</option>
				<option value="asc">Low to high</option>
			</select>
		</label>
		{#if filters.match === 'any'}<input type="hidden" name="match" value="any" />{/if}
		{#each filters.where as condition, index (index)}
			<input type="hidden" name="f" value={conditionParam(condition)} />
		{/each}
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
	}

	.team :global(.field) {
		width: 200px;
		padding: 7px 10px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
		line-height: 1.4;
		font-variant-numeric: tabular-nums;
	}

	.team :global(.field:hover) {
		border-color: var(--text-3);
	}

	.sort {
		display: none;
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
		.team :global(.field) {
			min-width: 0;
			width: 100%;
		}
	}

	@media (pointer: coarse) {
		.team :global(.field) {
			min-height: 40px;
		}
	}
	@media (pointer: coarse), (max-width: 600px) {
		.team :global(.field) {
			font-size: 16px;
		}
	}
</style>
