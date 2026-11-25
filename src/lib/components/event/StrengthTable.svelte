<script lang="ts">
	import Term from '#lib/ui/Term.svelte';
	import type { ScheduleStrength } from '#lib/analysis/types.ts';
	import { fixed, signed } from '#lib/format/number.ts';
	import type { Ranking, Team } from '#lib/types.ts';
	import Table from '#lib/ui/Table.svelte';
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

	const names = $derived(new Map(teams.map((team) => [team.number, team.name])));
	const ranks = $derived(new Map(rankings.map((row) => [row.team, row])));
	const rows = $derived(
		strength
			.flatMap((row) => {
				const ranking = ranks.get(row.team);
				if (!ranking) return [];
				return [{ ...row, rank: ranking.rank, name: names.get(row.team) ?? ranking.name }];
			})
			.sort((a, b) => a.rank - b.rank)
	);
</script>

<Table class="ranked">
	<caption class="visually-hidden">{title}</caption>
	<thead>
		<tr>
			<th class="l rank" scope="col">Rank</th>
			<th class="l" scope="col">Team</th>
			<th scope="col"><Term label="Rank by aOPR" /></th>
			<th class="opt" scope="col"><Term label="Partners' aOPR" /></th>
			<th class="opt" scope="col"><Term label="Opponents' aOPR" /></th>
			<th scope="col">Difference</th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.team)}
			<tr class:me={followed.has(row.team)}>
				<td class="l rank">{row.rank}</td>
				<td class="team">
					<TeamCell number={row.team} name={row.name} href={teamHref(row.team, eventCode)} />
				</td>
				<td>{row.ratingRank}</td>
				<td class="opt">{fixed(row.partners)}</td>
				<td class="opt">{fixed(row.opponents)}</td>
				<td>{signed(row.partners - row.opponents)}</td>
			</tr>
		{/each}
	</tbody>
</Table>
