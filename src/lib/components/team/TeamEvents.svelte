<script lang="ts">
	import Term from '#lib/ui/Term.svelte';
	import { fixed, MISSING, record } from '#lib/format/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Table from '#lib/ui/Table.svelte';
	import { shortRange } from '#lib/format/time.ts';
	import type { TeamEventRow } from './team-view.ts';

	interface Props {
		rows: TeamEventRow[];
		team: number;
	}

	let { rows, team }: Props = $props();

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
				<th class="l opt" scope="col">Date</th>
				<th scope="col">Rank</th>
				<th scope="col"><Term label="Record" /></th>
				<th scope="col"><Term label="OPR" /></th>
				<th class="l opt" scope="col">Playoffs</th>
				<th class="l opt" scope="col">Awards</th>
				<th class="l" scope="col"><span class="visually-hidden">Scouting report</span></th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.code)}
				<tr>
					<td class="l wrap"><a href="/events/{row.code}">{row.name}</a></td>
					<td class="l opt">{shortRange(row.start, row.end)}</td>
					<td>{row.rank ?? MISSING}</td>
					<td>{recordText(row)}</td>
					<td>{fixed(row.opr)}</td>
					<td class="l wrap wide opt">{row.playoffs ?? MISSING}</td>
					<td class="l wrap wide opt">{awardsText(row)}</td>
					<td class="l"><a href="/events/{row.code}/teams/{team}">Report</a></td>
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
