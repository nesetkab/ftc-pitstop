<script lang="ts">
	import type { TeamRating } from '#lib/analysis/types.ts';
	import { fixed } from '#lib/format/number.ts';
	import { record } from '#lib/format/record.ts';
	import type { Match, Ranking, Team } from '#lib/types.ts';
	import AllianceChip from '#lib/ui/AllianceChip.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';

	interface Props {
		match: Match;
		teams: Team[];
		rankings: Ranking[];
		ratings?: TeamRating[] | null;
		followed?: ReadonlySet<number>;
	}

	let { match, teams, rankings, ratings = null, followed = new Set() }: Props = $props();

	const names = $derived(new Map(teams.map((team) => [team.number, team.name])));
	const ranks = $derived(new Map(rankings.map((row) => [row.team, row])));
	const rated = $derived(ratings ? new Map(ratings.map((rating) => [rating.team, rating])) : null);
	const rows = $derived(
		(['red', 'blue'] as const).flatMap((color) =>
			match[color].map((entry) => ({ color, team: entry.team, surrogate: entry.surrogate }))
		)
	);
</script>

<Table>
	<caption class="visually-hidden">Teams in this match</caption>
	<thead>
		<tr>
			<th class="l" scope="col">Team</th>
			<th class="l" scope="col">Alliance</th>
			{#if rated}
				<th scope="col">OPR</th>
				<th scope="col">Auto</th>
				<th class="opt" scope="col">Hive</th>
				<th class="opt" scope="col">Park</th>
				<th class="opt" scope="col">Avg tips</th>
				<th class="opt" scope="col">Matches</th>
			{:else}
				<th scope="col">Rank</th>
				<th scope="col">RS</th>
				<th scope="col">Record</th>
				<th class="opt" scope="col">Avg tips</th>
				<th class="opt" scope="col">Matches</th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.team)}
			{@const rating = rated?.get(row.team)}
			{@const ranking = ranks.get(row.team)}
			<tr class:me={followed.has(row.team)}>
				<td class="team">
					<TeamCell number={row.team} name={names.get(row.team)} href="/teams/{row.team}" />
					{#if row.surrogate}
						<span class="faint">surrogate</span>
					{/if}
				</td>
				<td class="l"><AllianceChip alliance={row.color} /></td>
				{#if rated}
					<td>{fixed(rating?.opr)}</td>
					<td>{fixed(rating?.parts.auto)}</td>
					<td class="opt">{fixed(rating?.parts.hive)}</td>
					<td class="opt">{fixed(rating?.parts.park)}</td>
					<td class="opt">{fixed(rating?.parts.tips, 2)}</td>
					<td class="opt">{rating?.matches ?? '—'}</td>
				{:else}
					<td>{ranking?.rank ?? '—'}</td>
					<td>{fixed(ranking?.rs, 2)}</td>
					<td>{ranking ? record(ranking.wins, ranking.losses, ranking.ties) : '—'}</td>
					<td class="opt">{fixed(ranking?.avgTips)}</td>
					<td class="opt">{ranking?.played ?? '—'}</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</Table>
