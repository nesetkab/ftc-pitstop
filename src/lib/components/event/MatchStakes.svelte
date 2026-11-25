<script lang="ts">
	import { pct } from '#lib/format/pct.ts';
	import type { Team } from '#lib/types.ts';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import type { Stakes } from './stakes.ts';
	import Legend from '#lib/ui/Legend.svelte';

	interface Props {
		stakes: Stakes;
		teams: Team[];
		followed?: ReadonlySet<number>;
	}

	let { stakes, teams, followed = new Set() }: Props = $props();

	const names = $derived(new Map(teams.map((team) => [team.number, team.name])));
	const swing = $derived(
		stakes.teams.reduce(
			(best, row) => (row.win - row.loss > best.win - best.loss ? row : best),
			stakes.teams[0]
		)
	);
</script>

<Table>
	<caption class="visually-hidden">Chance to finish in the top {stakes.spots}</caption>
	<thead>
		<tr>
			<th class="l" scope="col">Team</th>
			<th scope="col">Now</th>
			<th scope="col">If they win</th>
			<th scope="col">If they lose</th>
		</tr>
	</thead>
	<tbody>
		{#each stakes.teams as row (row.team)}
			<tr class:me={followed.has(row.team)}>
				<td class="team">
					<TeamCell number={row.team} name={names.get(row.team)} href="/teams/{row.team}" />
				</td>
				<td>{pct(row.now)}</td>
				<td>{pct(row.win)}</td>
				<td>{pct(row.loss)}</td>
			</tr>
		{/each}
	</tbody>
</Table>
{#if swing && swing.win - swing.loss >= 0.05}
	<p class="note">
		{swing.team} has the most riding on this one: {pct(swing.win)} with a win, {pct(swing.loss)} with
		a loss.
	</p>
{/if}
<Legend>
	Chance each team finishes in the top {stakes.spots}, where alliance captains come from, after
	playing out the rest of the schedule.
</Legend>
