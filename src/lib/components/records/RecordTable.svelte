<script lang="ts">
	import { follows, syncFollows } from '#lib/components/follow/follow.svelte.ts';
	import { integer, shortDate, signed } from '#lib/format/index.ts';
	import Brand from '#lib/ui/Brand.svelte';
	import DataTable from '#lib/ui/DataTable.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import type { Column, SortState } from '#lib/ui/data-table.ts';
	import {
		clearedRecords,
		partLabel,
		RECORD_PART_NOTES,
		recordColumns,
		recordQuery,
		type RankedRecord,
		type RecordFilters,
		type RecordPart
	} from './records.ts';

	interface Props {
		rows: RankedRecord[];
		filters: RecordFilters;
		names: { teams: Record<number, string>; events: Record<string, string> };
		swipe?: boolean;
	}

	let { rows, filters, names, swipe = false }: Props = $props();

	const followed = $derived(new Set(follows.teams));
	const sort = $derived<SortState>({ key: filters.part, dir: filters.dir });

	$effect(() => syncFollows());

	function statColumn(key: RecordPart): Column<RankedRecord> {
		return {
			key,
			label: partLabel(key),
			title: RECORD_PART_NOTES[key],
			numeric: true,
			sort: (row) => row[key],
			text: (row) => (key === 'margin' ? signed(row.margin, 0) : integer(row[key])),
			hide: swipe ? undefined : 'tablet',
			class: 'stat'
		};
	}

	const columns = $derived<Column<RankedRecord>[]>([
		{ key: 'rank', label: 'Rank', numeric: true, text: (row) => integer(row.rank), class: 'rank' },
		...recordColumns(filters.part).map(statColumn),
		{ key: 'alliance', label: 'Alliance', cell: alliance, fill: !swipe, class: 'who' },
		{ key: 'event', label: 'Event', cell: event, hide: swipe ? undefined : 'phone' },
		{ key: 'match', label: 'Match', cell: match, hide: swipe ? undefined : 'phone' }
	]);

	function href(next: SortState) {
		return `/records${recordQuery({ ...filters, part: next.key as RecordPart, dir: next.dir }, 1)}`;
	}

	function side(row: RankedRecord) {
		return row.alliance === 'red' ? 'Red' : 'Blue';
	}

	function rowKey(row: RankedRecord) {
		return `${row.event}:${row.key}:${row.alliance}`;
	}

	function rowClass(row: RankedRecord) {
		return row.teams.some((team) => followed.has(team)) ? 'me' : undefined;
	}
</script>

{#snippet alliance(row: RankedRecord)}
	<span class="teams">
		{#each row.teams as team (team)}
			<a href="/teams/{team}"
				><b>{team}</b>{#if names.teams[team]}<span class="name"> {names.teams[team]}</span>{/if}</a
			>
		{/each}
	</span>
	<span class="brief">
		<a href="/events/{row.event}/matches/{row.key}"
			><Brand text={names.events[row.event] ?? row.event} /><span class="at">
				{row.label} <span class={row.alliance}>{side(row)}</span></span
			></a
		>
	</span>
{/snippet}

{#snippet event(row: RankedRecord)}
	<a class="event" href="/events/{row.event}"
		><Brand text={names.events[row.event] ?? row.event} /></a
	>
	<span class="date">{shortDate(row.day)}</span>
{/snippet}

{#snippet match(row: RankedRecord)}
	<a class="match" href="/events/{row.event}/matches/{row.key}">{row.label}</a>
	<span class={['side', row.alliance]}>{side(row)}</span>
{/snippet}

{#snippet empty()}
	<EmptyState title="No scores match these filters.">
		<a href={clearedRecords(filters)}>Clear filters</a>
	</EmptyState>
{/snippet}

<div class={['records', swipe ? 'swipe' : 'stack']}>
	<DataTable
		{rows}
		{columns}
		{rowKey}
		{rowClass}
		{sort}
		{href}
		{empty}
		caption="Highest alliance scores this season"
	/>
</div>

<style>
	.records :global(td.rank) {
		color: var(--text-2);
		font-weight: 400;
	}

	.records :global(:is(th, td).rank) {
		padding-left: 0;
		padding-right: 6px;
	}

	.records :global(:is(th, td).who) {
		padding-left: 18px;
	}

	.teams {
		display: grid;
	}

	.teams a {
		display: block;
		max-width: 260px;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text);
	}

	.teams b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.name {
		color: var(--text-2);
		font-weight: 400;
	}

	.brief {
		display: none;
	}

	.event {
		display: block;
		max-width: 280px;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text);
	}

	.date {
		font-size: 12.5px;
		color: var(--text-3);
	}

	.match {
		font-weight: 600;
		color: var(--text);
	}

	.side {
		margin-left: 6px;
		font-size: 13px;
	}

	.red {
		color: var(--red);
	}

	.blue {
		color: var(--blue);
	}

	@media (max-width: 1080px) {
		.stack .name {
			display: none;
		}
	}

	@media (max-width: 600px) {
		.stack {
			margin-inline: calc(var(--gutter) * -1);
			padding-inline: var(--gutter);
		}

		.stack :global(td) {
			vertical-align: top;
		}

		.stack :global(td.num.active) {
			font-size: 16px;
		}

		.stack :global(:is(td, th).who) {
			max-width: 0;
			padding-left: 10px;
			padding-right: 0;
		}

		.stack .teams {
			display: flex;
			gap: 12px;
		}

		.stack .brief {
			display: block;
			overflow: hidden;
			text-overflow: ellipsis;
			font-size: 13px;
			color: var(--text-2);
		}

		.stack .brief a {
			color: inherit;
		}

		.stack .at {
			margin-left: 6px;
			font-weight: 600;
			color: var(--text);
		}

		.swipe .name {
			display: none;
		}
	}
</style>
