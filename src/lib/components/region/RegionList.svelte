<script lang="ts">
	import { fixed, integer } from '#lib/format/number.ts';
	import Brand from '#lib/ui/Brand.svelte';
	import DataTable from '#lib/ui/DataTable.svelte';
	import type { Column, SortState } from '#lib/ui/data-table.ts';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import type { RegionSummary } from './regions.ts';

	interface Props {
		regions: RegionSummary[];
		caption: string;
		sort?: SortState | null;
	}

	let { regions, caption, sort = $bindable(null) }: Props = $props();

	const columns: Column<RegionSummary>[] = [
		{
			key: 'region',
			label: 'Region',
			sort: (region) => region.name,
			cell: name,
			class: 'region'
		},
		{
			key: 'teams',
			label: 'Teams',
			numeric: true,
			sort: (region) => region.teams,
			text: (region) => (region.teams === null ? '—' : integer(region.teams)),
			hide: 'phone',
			class: 'count'
		},
		{
			key: 'played',
			label: 'Played',
			numeric: true,
			sort: (region) => region.done,
			cell: played,
			class: 'count'
		},
		{
			key: 'left',
			label: 'Left',
			numeric: true,
			sort: (region) => region.live + region.upcoming,
			cell: left,
			hide: 'phone',
			class: 'left'
		},
		{
			key: 'top',
			label: 'Top team',
			sort: (region) => region.top?.team ?? null,
			cell: top,
			class: 'top'
		},
		{
			key: 'opr',
			label: 'aOPR',
			term: true,
			numeric: true,
			sort: (region) => region.top?.opr ?? null,
			text: (region) => (region.top ? fixed(region.top.opr) : ''),
			strong: true,
			class: 'score'
		}
	];

	function teamCount(region: RegionSummary) {
		if (region.teams === null) return 'No team list yet';
		const teams = `${integer(region.teams)} ${region.teams === 1 ? 'team' : 'teams'}`;
		if (region.live === 0) return teams;
		return `${teams}, ${integer(region.live)} ${region.live === 1 ? 'event' : 'events'} today`;
	}
</script>

{#snippet name(region: RegionSummary)}
	<a href="/regions/{region.code}"><Brand text={region.name} /></a>
	<span class="sub">{teamCount(region)}</span>
{/snippet}

{#snippet played(region: RegionSummary)}
	{integer(region.done)} <span class="faint">of {integer(region.events)}</span>
{/snippet}

{#snippet left(region: RegionSummary)}
	{integer(region.live + region.upcoming)}
	{#if region.live > 0}
		<span class="live">{integer(region.live)} today</span>
	{/if}
{/snippet}

{#snippet top(region: RegionSummary)}
	{#if region.top}
		<TeamCell number={region.top.team} name={region.top.name} href="/teams/{region.top.team}" />
	{:else}
		<span class="faint">Not rated yet</span>
	{/if}
{/snippet}

<div class="region-list">
	<DataTable rows={regions} {columns} rowKey={(region) => region.code} bind:sort {caption} />
</div>

<style>
	.region-list :global(table) {
		table-layout: fixed;
	}

	.region-list :global(th.region) {
		width: 28%;
	}

	.region-list :global(th.count) {
		width: 11%;
	}

	.region-list :global(th.left) {
		width: 13%;
	}

	.region-list :global(th.score) {
		width: 9%;
	}

	.region-list :global(th.top) {
		width: auto;
	}

	.region-list :global(td.region) {
		white-space: normal;
	}

	.region-list :global(td.region a) {
		font-weight: 500;
	}

	.region-list :global(td.top) {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sub {
		display: none;
		font-size: 13px;
		color: var(--text-2);
	}

	.live {
		margin-left: 6px;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--text);
	}

	@media (max-width: 600px) {
		.region-list :global(th.region) {
			width: 34%;
		}

		.region-list :global(th.count) {
			width: 22%;
		}

		.region-list :global(th.score) {
			width: 16%;
		}

		.sub {
			display: block;
		}

		.region-list :global(td.top .name) {
			display: none;
		}
	}
</style>
