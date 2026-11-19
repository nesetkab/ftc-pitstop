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
	const showEvents = $derived(rows.some((row) => row.events !== null));

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
				<th class="l optional" scope="col">Location</th>
				<th scope="col">OPR</th>
				<th scope="col">Auto</th>
				<th scope="col">Teleop</th>
				<th class="optional" scope="col">Tips</th>
				<th class="optional" scope="col">Matches</th>
				{#if showEvents}
					<th class="optional" scope="col">Events</th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each rows as row, index (row.team)}
				{@const link = `/teams/${row.team}`}
				<tr class:me={followed.has(row.team)}>
					<td class="l">{integer(start + index + 1)}</td>
					<td class="team">
						<div class="team-name"><TeamCell number={row.team} name={row.name} href={link} /></div>
					</td>
					<td class="l optional">{placeName(row, 'short') || MISSING}</td>
					<td>{fixed(row.opr)}</td>
					<td>{fixed(row.auto)}</td>
					<td>{fixed(row.teleop)}</td>
					<td class="optional">{fixed(row.tips)}</td>
					<td class="optional">{integer(row.matches)}</td>
					{#if showEvents}
						<td class="optional">{row.events === null ? MISSING : integer(row.events)}</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}

<style>
	.team-name {
		max-width: 320px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 640px) {
		.optional {
			display: none;
		}

		.team-name {
			max-width: none;
			overflow: visible;
			white-space: normal;
		}
	}
</style>
