<script lang="ts">
	import { fixed } from '#lib/format/number.ts';
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
				<th scope="col">OPR</th>
				<th scope="col">Auto OPR</th>
			{:else}
				<th scope="col">RS</th>
				<th scope="col">TBP</th>
				<th scope="col">Avg auto</th>
			{/if}
			<th scope="col">Avg tips</th>
			<th scope="col">Avg park</th>
			<th scope="col">Rank</th>
			{#if table.picks}
				<th scope="col">Win round 1</th>
				<th scope="col">Reach upper final</th>
				<th scope="col">Win event</th>
			{/if}
			<th class="l" scope="col">Note</th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.team)}
			{@const taken = row.status.kind !== 'available'}
			<tr class:dim={taken} class:me={row.team === me}>
				<td class="team"><TeamCell number={row.team} name={row.name} href="/teams/{row.team}" /></td
				>
				{#if table.rated}
					<td>{fixed(row.opr)}</td>
					<td>{fixed(row.autoOpr)}</td>
				{:else}
					<td>{fixed(row.rs, 2)}</td>
					<td>{fixed(row.tbp)}</td>
					<td>{fixed(row.avgAuto)}</td>
				{/if}
				<td>{fixed(row.avgTips)}</td>
				<td>{fixed(row.avgPark)}</td>
				<td>{row.rank ?? '—'}</td>
				{#if table.picks}
					{#if taken}
						<td></td>
						<td></td>
						<td></td>
					{:else}
						<ProbCell p={row.winRound1} shade={false} />
						<ProbCell p={row.reachUpperFinal} shade={false} />
						<ProbCell p={row.winEvent} shade={false} />
					{/if}
				{/if}
				<td class="l">{note(row)}</td>
			</tr>
		{/each}
	</tbody>
</Table>
