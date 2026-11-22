<script lang="ts">
	import type { Projection, TeamRating } from '#lib/analysis/types.ts';
	import { fixed } from '#lib/format/number.ts';
	import { ordinal } from '#lib/format/ordinal.ts';
	import { record } from '#lib/format/record.ts';
	import type { Ranking, Team } from '#lib/types.ts';
	import FinishSpark from '#lib/ui/FinishSpark.svelte';
	import ProbCell from '#lib/ui/ProbCell.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';

	interface Props {
		rankings: Ranking[];
		teams: Team[];
		ratings?: TeamRating[] | null;
		projections?: Projection[] | null;
		qualCount?: number;
		followed?: ReadonlySet<number>;
	}

	let {
		rankings,
		teams,
		ratings = null,
		projections = null,
		qualCount = 0,
		followed = new Set()
	}: Props = $props();

	const names = $derived(new Map(teams.map((team) => [team.number, team.name])));
	const opr = $derived(
		ratings ? new Map(ratings.map((rating) => [rating.team, rating.opr])) : null
	);
	const projected = $derived(
		projections && projections.length > 0
			? new Map(projections.map((projection) => [projection.team, projection]))
			: null
	);
	const baseColumns = $derived(opr ? 7 : 6);
</script>

<Table>
	<caption class="visually-hidden">Rankings</caption>
	<thead>
		{#if projected}
			<tr class="opt">
				<td colspan={baseColumns}></td>
				<th colspan="3" scope="colgroup" class="group sep">Projected after {qualCount} matches</th>
			</tr>
		{/if}
		<tr>
			<th class="l" scope="col">Rank</th>
			<th class="l" scope="col">Team</th>
			<th scope="col">RS</th>
			<th class={{ opt: projected !== null }} scope="col">Record</th>
			<th class="opt" scope="col">TBP</th>
			<th class="opt" scope="col">Avg tips</th>
			{#if opr}
				<th scope="col">OPR</th>
			{/if}
			{#if projected}
				<th class="sep opt" scope="col">Finish, 1st to {ordinal(rankings.length)}</th>
				<th class="opt" scope="col">Top 4</th>
				<th scope="col">Top 8</th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rankings as row (row.team)}
			{@const projection = projected?.get(row.team)}
			<tr class:me={followed.has(row.team)}>
				<td class="l">{row.rank}</td>
				<td class="team">
					<TeamCell
						number={row.team}
						name={names.get(row.team) ?? row.name}
						href="/teams/{row.team}"
					/>
				</td>
				<td>{fixed(row.rs, 2)}</td>
				<td class={{ opt: projected !== null }}>{record(row.wins, row.losses, row.ties)}</td>
				<td class="opt">{fixed(row.tbp)}</td>
				<td class="opt">{fixed(row.avgTips)}</td>
				{#if opr}
					<td>{fixed(opr.get(row.team))}</td>
				{/if}
				{#if projected}
					<td class="sep opt">
						{#if projection}
							<FinishSpark dist={projection.rankChances} />
						{/if}
					</td>
					<ProbCell p={projection?.top4} class="opt" />
					<ProbCell p={projection?.top8} />
				{/if}
			</tr>
		{/each}
	</tbody>
</Table>
