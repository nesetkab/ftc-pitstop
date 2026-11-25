<script lang="ts">
	import type { ScheduleStrength } from '#lib/analysis/types.ts';
	import { fixed, signed } from '#lib/format/number.ts';
	import type { Ranking, Team } from '#lib/types.ts';
	import DataTable from '#lib/ui/DataTable.svelte';
	import type { Column, SortState } from '#lib/ui/data-table.ts';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import { teamHref } from './matches.ts';

	interface Props {
		strength: ScheduleStrength[];
		rankings: Ranking[];
		teams: Team[];
		followed?: ReadonlySet<number>;
		title?: string;
		eventCode?: string;
	}

	let {
		strength,
		rankings,
		teams,
		followed = new Set(),
		title = 'Schedule so far',
		eventCode
	}: Props = $props();

	type Row = ScheduleStrength & { rank: number; name: string | undefined };

	let sort = $state<SortState | null>(null);

	const names = $derived(new Map(teams.map((team) => [team.number, team.name])));
	const ranks = $derived(new Map(rankings.map((row) => [row.team, row])));
	const rows = $derived<Row[]>(
		strength
			.flatMap((row) => {
				const ranking = ranks.get(row.team);
				if (!ranking) return [];
				return [{ ...row, rank: ranking.rank, name: names.get(row.team) ?? ranking.name }];
			})
			.sort((a, b) => a.rank - b.rank)
	);

	const columns: Column<Row>[] = [
		{
			key: 'rank',
			label: 'Rank',
			first: 'asc',
			sort: (row) => row.rank,
			text: (row) => String(row.rank),
			class: 'rank'
		},
		{
			key: 'team',
			label: 'Team',
			sort: (row) => row.team,
			cell: teamCell
		},
		{
			key: 'rating',
			label: 'Rank by aOPR',
			term: true,
			numeric: true,
			first: 'asc',
			sort: (row) => row.ratingRank,
			text: (row) => String(row.ratingRank)
		},
		{
			key: 'partners',
			label: "Partners' aOPR",
			term: true,
			numeric: true,
			sort: (row) => row.partners,
			text: (row) => fixed(row.partners),
			hide: 'phone'
		},
		{
			key: 'opponents',
			label: "Opponents' aOPR",
			term: true,
			numeric: true,
			sort: (row) => row.opponents,
			text: (row) => fixed(row.opponents),
			hide: 'phone'
		},
		{
			key: 'difference',
			label: 'Difference',
			numeric: true,
			sort: (row) => row.partners - row.opponents,
			text: (row) => signed(row.partners - row.opponents)
		}
	];

	function rowClass(row: Row) {
		return followed.has(row.team) ? 'me' : undefined;
	}
</script>

{#snippet teamCell(row: Row)}
	<TeamCell number={row.team} name={row.name} href={teamHref(row.team, eventCode)} />
{/snippet}

<DataTable
	{rows}
	{columns}
	rowKey={(row) => String(row.team)}
	{rowClass}
	bind:sort
	caption={title}
	class="ranked"
/>
