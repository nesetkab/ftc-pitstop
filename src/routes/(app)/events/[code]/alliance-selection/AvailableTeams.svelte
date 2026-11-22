<script lang="ts">
	import { fixed } from '#lib/format/number.ts';
	import { MISSING } from '#lib/format/pct.ts';
	import ProbCell from '#lib/ui/ProbCell.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import { takenLabel, type SelectionTable, type TeamRow } from '#lib/workspace/selection.ts';

	interface Props {
		table: SelectionTable;
		me?: number | null;
	}

	let { table, me = null }: Props = $props();

	function note(row: TeamRow): string {
		if (row.status.kind !== 'available') return takenLabel(row.status) ?? '';
		if (row.status.captainOf === null) return '';
		if (row.promotes !== null) {
			return `Makes ${row.promotes} captain of alliance ${row.status.captainOf}`;
		}
		return `Captain of alliance ${row.status.captainOf}`;
	}

	const rows = $derived([...table.available, ...table.taken]);
</script>

<Table>
	<thead>
		<tr>
			<th class="l" scope="col">Team</th>
			{#if table.rated}
				<th class="w" scope="col">OPR</th>
				<th class="w" scope="col">Auto OPR</th>
			{:else}
				<th class="w" scope="col">RS</th>
				<th class="w opt" scope="col">TBP</th>
				<th class="w" scope="col">Avg auto</th>
			{/if}
			<th class="w opt" scope="col">Avg tips</th>
			<th class="w opt" scope="col">Avg park</th>
			<th class="w" scope="col">Rank</th>
			{#if table.picks}
				<th class="w opt" scope="col">Win round 1</th>
				<th class="w opt" scope="col">Reach upper final</th>
				<th class="w" scope="col">Win event</th>
			{/if}
			<th class="l opt" scope="col">Note</th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.team)}
			{@const taken = row.status.kind !== 'available'}
			<tr class:dim={taken} class:me={row.team === me}>
				<td class="team wrap"
					><TeamCell number={row.team} name={row.name} href="/teams/{row.team}" /></td
				>
				{#if table.rated}
					<td>{fixed(row.opr)}</td>
					<td>{fixed(row.autoOpr)}</td>
				{:else}
					<td>{fixed(row.rs, 2)}</td>
					<td class="opt">{fixed(row.tbp)}</td>
					<td>{fixed(row.avgAuto)}</td>
				{/if}
				<td class="opt">{fixed(row.avgTips)}</td>
				<td class="opt">{fixed(row.avgPark)}</td>
				<td>{row.rank ?? MISSING}</td>
				{#if table.picks}
					{#if taken}
						<td class="opt"></td>
						<td class="opt"></td>
						<td></td>
					{:else}
						<ProbCell p={row.winRound1} shade={false} class="opt" />
						<ProbCell p={row.reachUpperFinal} shade={false} class="opt" />
						<ProbCell p={row.winEvent} shade={false} />
					{/if}
				{/if}
				<td class="l wrap note opt">{note(row)}</td>
			</tr>
		{/each}
	</tbody>
</Table>

<style>
	th.w {
		min-width: 0;
		white-space: normal;
	}

	td.note {
		min-width: 150px;
	}
</style>
