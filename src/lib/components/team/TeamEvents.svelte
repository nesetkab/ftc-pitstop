<script lang="ts">
	import { fixed, MISSING, record } from '#lib/format/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Table from '#lib/ui/Table.svelte';
	import { shortRange } from './dates.ts';
	import type { TeamEventRow } from './team-view.ts';

	interface Props {
		rows: TeamEventRow[];
	}

	let { rows }: Props = $props();

	function recordText(row: TeamEventRow): string {
		return row.record ? record(row.record.wins, row.record.losses, row.record.ties) : MISSING;
	}

	function awardsText(row: TeamEventRow): string {
		return row.awards.length > 0 ? row.awards.join(', ') : MISSING;
	}
</script>

{#if rows.length === 0}
	<EmptyState title="This team has no events this season." />
{:else}
	<Table>
		<thead>
			<tr>
				<th class="l" scope="col">Event</th>
				<th class="l" scope="col">Date</th>
				<th scope="col">Rank</th>
				<th scope="col">Record</th>
				<th scope="col">OPR</th>
				<th class="l" scope="col">Playoffs</th>
				<th class="l" scope="col">Awards</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.code)}
				<tr>
					<td class="l"><a href="/events/{row.code}">{row.name}</a></td>
					<td class="l">{shortRange(row.start, row.end)}</td>
					<td>{row.rank ?? MISSING}</td>
					<td>{recordText(row)}</td>
					<td>{fixed(row.opr)}</td>
					<td class="l wrap wide">{row.playoffs ?? MISSING}</td>
					<td class="l wrap wide">{awardsText(row)}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
	<p class="note">Rank and record are from qualification matches.</p>
{/if}

<style>
	.wide {
		min-width: 14em;
	}
</style>
