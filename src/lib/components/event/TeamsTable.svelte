<script lang="ts" module>
	export type SeasonStanding = { opr: number; rank: number };
</script>

<script lang="ts">
	import type { TeamRating } from '#lib/analysis/types.ts';
	import { fixed, integer } from '#lib/format/number.ts';
	import type { Ranking, Team } from '#lib/types.ts';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import { placeName } from '#lib/format/places.ts';

	interface Props {
		teams: Team[];
		rankings?: Ranking[];
		ratings?: TeamRating[] | null;
		season?: Record<number, SeasonStanding> | null;
		seasonCount?: number | null;
		followed?: ReadonlySet<number>;
	}

	let {
		teams,
		rankings = [],
		ratings = null,
		season = null,
		seasonCount = null,
		followed = new Set()
	}: Props = $props();

	const ranks = $derived(new Map(rankings.map((row) => [row.team, row.rank])));
	const opr = $derived(
		ratings ? new Map(ratings.map((rating) => [rating.team, rating.opr])) : null
	);
	const stats = $derived(ranks.size > 0 || opr !== null || season !== null);
	const sorted = $derived([...teams].sort((a, b) => a.number - b.number));
</script>

<Table>
	<caption class="visually-hidden">Teams at this event</caption>
	<thead>
		<tr>
			<th class="l" scope="col">Team</th>
			<th class={['l', { opt: stats }]} scope="col">Location</th>
			<th class="opt" scope="col">Rookie year</th>
			{#if ranks.size > 0}
				<th scope="col">Rank</th>
			{/if}
			{#if opr}
				<th scope="col">OPR here</th>
			{/if}
			{#if season}
				<th scope="col">Season OPR</th>
				<th class="opt" scope="col">World rank</th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each sorted as team (team.number)}
			{@const standing = season?.[team.number]}
			<tr class:me={followed.has(team.number)}>
				<td class="team">
					<TeamCell number={team.number} name={team.name} href="/teams/{team.number}" />
				</td>
				<td class={['l muted', { opt: stats }]}>
					{placeName(team)}
				</td>
				<td class="opt">{team.rookieYear ?? '—'}</td>
				{#if ranks.size > 0}
					<td>{ranks.get(team.number) ?? '—'}</td>
				{/if}
				{#if opr}
					<td>{fixed(opr.get(team.number))}</td>
				{/if}
				{#if season}
					<td>{fixed(standing?.opr)}</td>
					<td class="opt">
						{#if standing}
							{integer(standing.rank)}{#if seasonCount}<span class="faint"
									>{` of ${integer(seasonCount)}`}</span
								>{/if}
						{:else}
							—
						{/if}
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</Table>
