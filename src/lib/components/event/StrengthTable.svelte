<script lang="ts">
	import type { ScheduleStrength } from '#lib/analysis/types.ts';
	import { fixed, signed } from '#lib/format/number.ts';
	import type { Ranking, Team } from '#lib/types.ts';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';

	interface Props {
		strength: ScheduleStrength[];
		rankings: Ranking[];
		teams: Team[];
		followed?: ReadonlySet<number>;
	}

	let { strength, rankings, teams, followed = new Set() }: Props = $props();

	const names = $derived(new Map(teams.map((team) => [team.number, team.name])));
	const ranks = $derived(new Map(rankings.map((row) => [row.team, row.rank])));
	const rows = $derived(
		strength
			.flatMap((row) => {
				const rank = ranks.get(row.team);
				return rank === undefined ? [] : [{ ...row, rank, gap: rank - row.ratingRank }];
			})
			.sort((a, b) => b.gap - a.gap || a.rank - b.rank)
	);
</script>

<div class="strength">
	<Table>
		<caption class="visually-hidden">Schedule so far</caption>
		<thead>
			<tr>
				<th class="l" scope="col">Team</th>
				<th scope="col">Rank</th>
				<th scope="col">Rank by OPR</th>
				<th scope="col">Partners' OPR</th>
				<th scope="col">Opponents' OPR</th>
				<th scope="col">Difference</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.team)}
				<tr class:me={followed.has(row.team)}>
					<td class="team">
						<TeamCell number={row.team} name={names.get(row.team)} href="/teams/{row.team}" />
					</td>
					<td>{row.rank}</td>
					<td>{row.ratingRank}</td>
					<td>{fixed(row.partners)}</td>
					<td>{fixed(row.opponents)}</td>
					<td>{signed(row.partners - row.opponents)}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
</div>

<style>
	.strength {
		max-width: 780px;
	}
</style>
