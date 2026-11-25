<script lang="ts">
	import { fixed, integer } from '#lib/format/number.ts';
	import DataTable from '#lib/ui/DataTable.svelte';
	import type { Column, SortState } from '#lib/ui/data-table.ts';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import type { RegionTeam } from './regions.ts';

	interface Props {
		teams: RegionTeam[];
		caption: string;
		followed?: ReadonlySet<number>;
	}

	let { teams, caption, followed = new Set() }: Props = $props();

	let sort = $state<SortState | null>(null);

	const places = $derived(new Map(teams.map((team, index) => [team.team, index + 1])));

	const columns: Column<RegionTeam>[] = [
		{
			key: 'place',
			label: '#',
			term: true,
			numeric: true,
			first: 'asc',
			sort: (team) => places.get(team.team) ?? null,
			text: (team) => integer(places.get(team.team)),
			class: 'at'
		},
		{
			key: 'team',
			label: 'Team',
			sort: (team) => team.team,
			cell: teamCell
		},
		{
			key: 'location',
			label: 'Location',
			sort: (team) => team.place,
			cell: location,
			hide: 'tablet'
		},
		{
			key: 'opr',
			label: 'aOPR',
			term: true,
			numeric: true,
			sort: (team) => team.opr,
			text: (team) => fixed(team.opr),
			strong: true
		},
		{
			key: 'auto',
			label: 'Auto',
			term: 'Auto aOPR',
			numeric: true,
			sort: (team) => team.auto,
			text: (team) => fixed(team.auto),
			hide: 'phone'
		},
		{
			key: 'teleop',
			label: 'Teleop',
			term: 'Teleop aOPR',
			numeric: true,
			sort: (team) => team.teleop,
			text: (team) => fixed(team.teleop),
			hide: 'phone'
		},
		{
			key: 'world',
			label: 'World rank',
			term: true,
			numeric: true,
			first: 'asc',
			sort: (team) => team.rank,
			text: (team) => integer(team.rank)
		}
	];

	function rowClass(team: RegionTeam) {
		return followed.has(team.team) ? 'me' : undefined;
	}
</script>

{#snippet teamCell(team: RegionTeam)}
	<TeamCell number={team.team} name={team.name} href="/teams/{team.team}" />
{/snippet}

{#snippet location(team: RegionTeam)}
	<span class="muted">{team.place ?? ''}</span>
{/snippet}

<div class="region-teams">
	<DataTable
		rows={teams}
		{columns}
		rowKey={(team) => String(team.team)}
		{rowClass}
		bind:sort
		{caption}
	/>
</div>

<style>
	.region-teams :global(td.at) {
		color: var(--text-2);
		font-weight: 400;
	}

	.region-teams :global(:is(th, td).at) {
		padding-left: 0;
	}
</style>
