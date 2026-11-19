<script lang="ts">
	import { fixed, integer, MISSING } from '#lib/format/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import { follows, syncFollows } from './follow.svelte.ts';
	import type { LeaderboardRow } from './leaderboard.ts';
	import { placeName } from './places.ts';

	interface Props {
		rows: LeaderboardRow[];
		start: number;
		caption?: string;
	}

	let { rows, start, caption = 'Teams ranked by season OPR' }: Props = $props();

	const followed = $derived(new Set(follows.teams));

	$effect(() => syncFollows());
</script>

{#if rows.length === 0}
	<EmptyState title="No teams match these filters.">Try other filters.</EmptyState>
{:else}
	<Table>
		<caption class="visually-hidden">{caption}</caption>
		<thead>
			<tr>
				<th class="l" scope="col">Rank</th>
				<th class="l" scope="col">Team</th>
				<th class="l" scope="col">Location</th>
				<th scope="col">OPR</th>
				<th scope="col">Auto</th>
				<th scope="col">Teleop</th>
				<th scope="col">Tips</th>
				<th scope="col">Matches</th>
				<th scope="col">Events</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row, index (row.team)}
				<tr class:me={followed.has(row.team)}>
					<td class="l">{integer(start + index + 1)}</td>
					<td class="team"
						><TeamCell number={row.team} name={row.name} href="/teams/{row.team}" /></td
					>
					<td class="l">{placeName(row, 'short') || MISSING}</td>
					<td>{fixed(row.opr)}</td>
					<td>{fixed(row.auto)}</td>
					<td>{fixed(row.teleop)}</td>
					<td>{fixed(row.tips)}</td>
					<td>{integer(row.matches)}</td>
					<td>{row.events === null ? MISSING : integer(row.events)}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}
