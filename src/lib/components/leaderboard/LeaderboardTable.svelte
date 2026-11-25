<script lang="ts">
	import { follows, syncFollows } from '#lib/components/follow/follow.svelte.ts';
	import { oprTerm } from '#lib/format/glossary.ts';
	import { fixed, integer, MISSING } from '#lib/format/index.ts';
	import { placeName } from '#lib/format/places.ts';
	import DataTable from '#lib/ui/DataTable.svelte';
	import type { Column, SortState } from '#lib/ui/data-table.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import {
		queryString,
		type LeaderboardFilters,
		type LeaderboardRow,
		type LeaderboardSort
	} from './leaderboard.ts';

	interface Props {
		rows: LeaderboardRow[];
		start: number;
		filters?: LeaderboardFilters;
		caption?: string;
	}

	let { rows, start, filters, caption = 'Teams ranked by season aOPR' }: Props = $props();

	const STATS: { key: LeaderboardSort; label: string; optional?: boolean }[] = [
		{ key: 'opr', label: 'aOPR' },
		{ key: 'auto', label: 'Auto' },
		{ key: 'teleop', label: 'Teleop' },
		{ key: 'tips', label: 'Tips', optional: true },
		{ key: 'matches', label: 'Matches', optional: true }
	];

	const followed = $derived(new Set(follows.teams));
	const showEvents = $derived(rows.some((row) => row.events !== null));
	const sortKey = $derived(filters?.sort ?? 'opr');
	const sort = $derived<SortState>({ key: sortKey, dir: 'desc' });
	const extra = $derived(STATS.some((stat) => stat.optional && stat.key === sortKey));
	const places = $derived(new Map(rows.map((row, index) => [row.team, start + index + 1])));

	$effect(() => syncFollows());

	function value(row: LeaderboardRow, key: LeaderboardSort): string {
		return key === 'matches' ? integer(row.matches) : fixed(row[key]);
	}

	const columns = $derived.by(() => {
		const list: Column<LeaderboardRow>[] = [
			{ key: 'rank', label: 'Rank', text: (row) => integer(places.get(row.team)), class: 'at' },
			{ key: 'team', label: 'Team', cell: teamCell },
			{
				key: 'location',
				label: 'Location',
				text: (row) => placeName(row, 'short') || MISSING,
				hide: 'phone'
			}
		];
		for (const stat of STATS) {
			list.push({
				key: stat.key,
				label: stat.label,
				term: oprTerm(stat.label),
				numeric: true,
				sort: filters ? (row) => row[stat.key] : undefined,
				text: (row) => value(row, stat.key),
				hide: stat.optional || (extra && stat.key === 'teleop') ? 'phone' : undefined
			});
		}
		if (showEvents) {
			list.push({
				key: 'events',
				label: 'Events',
				numeric: true,
				text: (row) => (row.events === null ? MISSING : integer(row.events)),
				hide: 'tablet'
			});
		}
		return list;
	});

	function href(next: SortState) {
		return `/leaderboards${queryString({ ...filters!, sort: next.key as LeaderboardSort }, 1)}`;
	}

	function rowClass(row: LeaderboardRow) {
		return [followed.has(row.team) && 'me', filters?.team === row.team && 'target']
			.filter(Boolean)
			.join(' ');
	}
</script>

{#snippet teamCell(row: LeaderboardRow)}
	<div class="team-name">
		<TeamCell number={row.team} name={row.name} href="/teams/{row.team}" />
	</div>
{/snippet}

{#snippet empty()}
	<EmptyState title="No teams match these filters.">
		<a href="/leaderboards">Clear filters</a>
	</EmptyState>
{/snippet}

<div class="leaderboard">
	<DataTable
		{rows}
		{columns}
		rowKey={(row) => String(row.team)}
		{rowClass}
		rowCurrent={(row) => filters?.team === row.team}
		{sort}
		href={filters ? href : undefined}
		{empty}
		{caption}
	/>
</div>

<style>
	.team-name {
		max-width: 320px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.leaderboard :global(td.at) {
		color: var(--text-2);
		font-weight: 400;
	}

	.leaderboard :global(:is(th, td).at) {
		padding-left: 0;
	}

	.leaderboard :global(tr.target td) {
		box-shadow:
			inset 0 1px 0 var(--text),
			inset 0 -1px 0 var(--text);
	}

	.leaderboard :global(tr.target td:first-child) {
		box-shadow:
			inset 2px 0 0 var(--text),
			inset 0 1px 0 var(--text),
			inset 0 -1px 0 var(--text);
	}

	@media (max-width: 600px) {
		.team-name {
			overflow: visible;
		}
	}
</style>
