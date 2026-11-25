<script lang="ts">
	import { typeLabel } from '#lib/components/event/event-meta.ts';
	import { fixed } from '#lib/format/number.ts';
	import { shortRange } from '#lib/format/time.ts';
	import Brand from '#lib/ui/Brand.svelte';
	import DataTable from '#lib/ui/DataTable.svelte';
	import type { Column, SortState } from '#lib/ui/data-table.ts';
	import type { RegionEvent } from './regions.ts';

	interface Props {
		events: RegionEvent[];
		caption: string;
	}

	let { events, caption }: Props = $props();

	let sort = $state<SortState | null>(null);

	const columns: Column<RegionEvent>[] = [
		{
			key: 'event',
			label: 'Event',
			sort: (event) => event.name,
			cell: name,
			class: 'name'
		},
		{
			key: 'type',
			label: 'Type',
			sort: (event) => typeLabel(event.type),
			cell: type,
			hide: 'tablet'
		},
		{
			key: 'dates',
			label: 'Dates',
			sort: (event) => event.start,
			text: (event) => shortRange(event.start, event.end)
		},
		{
			key: 'teams',
			label: 'Teams',
			numeric: true,
			sort: (event) => event.teams,
			text: (event) => String(event.teams ?? '—'),
			hide: 'phone'
		},
		{
			key: 'strength',
			label: 'Strength',
			term: true,
			numeric: true,
			sort: (event) => event.strength,
			text: (event) => fixed(event.strength)
		}
	];
</script>

{#snippet name(event: RegionEvent)}
	<a href="/events/{event.code}"><Brand text={event.name} /></a>
	<span class="sub">{event.place ?? ''}</span>
{/snippet}

{#snippet type(event: RegionEvent)}
	<span class="muted"><Brand text={typeLabel(event.type)} /></span>
{/snippet}

<div class="region-events">
	<DataTable rows={events} {columns} rowKey={(event) => event.code} bind:sort {caption} />
</div>

<style>
	.region-events :global(td.name) {
		min-width: 220px;
		white-space: normal;
	}

	.region-events :global(td.name a) {
		font-weight: 500;
	}

	.sub {
		display: block;
		font-size: 13px;
		color: var(--text-2);
	}

	@media (max-width: 760px) {
		.region-events :global(td.name) {
			min-width: 0;
		}
	}
</style>
