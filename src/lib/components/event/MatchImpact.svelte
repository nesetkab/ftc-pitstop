<script lang="ts">
	import Term from '#lib/ui/Term.svelte';
	import { fixed, signed } from '#lib/format/number.ts';
	import type { Match, Team } from '#lib/types.ts';
	import AllianceChip from '#lib/ui/AllianceChip.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import type { RankShift } from './standings.ts';

	type Shift = { before: number; after: number };

	interface Props {
		match: Match;
		teams: Team[];
		ranks?: ReadonlyMap<number, RankShift> | null;
		oprs?: Record<number, Shift> | null;
		followed?: ReadonlySet<number>;
	}

	let { match, teams, ranks = null, oprs = null, followed = new Set() }: Props = $props();

	const names = $derived(new Map(teams.map((team) => [team.number, team.name])));
	const rows = $derived(
		(['red', 'blue'] as const).flatMap((color) =>
			match[color].map((entry) => ({
				color,
				team: entry.team,
				rank: ranks?.get(entry.team) ?? null,
				opr: oprs?.[entry.team] ?? null
			}))
		)
	);
	const showRank = $derived(rows.some((row) => row.rank !== null));
	const showOpr = $derived(rows.some((row) => row.opr !== null));

	function moved(rank: RankShift): string {
		if (rank.before === null) return 'first match';
		const change = rank.before - rank.after;
		if (change === 0) return 'no change';
		return change > 0 ? `up ${change}` : `down ${-change}`;
	}
</script>

<Table>
	<caption class="visually-hidden">What this match changed</caption>
	<thead>
		<tr>
			<th class="l" scope="col">Team</th>
			<th class="l opt" scope="col">Alliance</th>
			{#if showRank}
				<th scope="col">Rank</th>
				<th class="l opt" scope="col"><span class="visually-hidden">Rank change</span></th>
			{/if}
			{#if showOpr}
				<th scope="col"><Term label="aOPR" /></th>
				<th scope="col">Change</th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.team)}
			<tr class:me={followed.has(row.team)}>
				<td class="team">
					<TeamCell number={row.team} name={names.get(row.team)} href="/teams/{row.team}" />
				</td>
				<td class="l opt"><AllianceChip alliance={row.color} /></td>
				{#if showRank}
					{#if row.rank}
						<td>{row.rank.before ?? '—'} → {row.rank.after}</td>
						<td class="l muted opt">{moved(row.rank)}</td>
					{:else}
						<td>—</td>
						<td class="opt"></td>
					{/if}
				{/if}
				{#if showOpr}
					{#if row.opr}
						<td><span class="was">{`${fixed(row.opr.before)} → `}</span>{fixed(row.opr.after)}</td>
						<td>{signed(row.opr.after - row.opr.before)}</td>
					{:else}
						<td>—</td>
						<td>—</td>
					{/if}
				{/if}
			</tr>
		{/each}
	</tbody>
</Table>

<style>
	@media (max-width: 600px) {
		.was {
			display: none;
		}
	}
</style>
