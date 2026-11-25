<script lang="ts">
	import Brand from '#lib/ui/Brand.svelte';
	import { integer, MISSING } from '#lib/format/index.ts';
	import { shortRange } from '#lib/format/time.ts';
	import Table from '#lib/ui/Table.svelte';
	import type { UpcomingEventRow } from './season-report.ts';

	interface Props {
		rows: UpcomingEventRow[];
		team: number;
	}

	let { rows, team }: Props = $props();
</script>

<Table>
	<thead>
		<tr>
			<th class="l" scope="col">Event</th>
			<th class="l opt" scope="col">Date</th>
			<th class="opt" scope="col">Teams</th>
			<th class="l" scope="col">Outlook</th>
			<th class="l" scope="col"><span class="visually-hidden">Scouting report</span></th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.code)}
			<tr>
				<td class="l wrap">
					<a href="/events/{row.code}"><Brand text={row.name} /></a>
					{#if row.live}<span class="live">Now</span>{/if}
				</td>
				<td class="l opt">{shortRange(row.start, row.end)}</td>
				<td class="opt">{row.registered === null ? MISSING : integer(row.registered)}</td>
				<td class={['l wrap', { muted: row.kind === 'none' }]}>{row.outlook}</td>
				<td class="l"><a href="/events/{row.code}/teams/{team}">Report</a></td>
			</tr>
		{/each}
	</tbody>
</Table>

<style>
	.live {
		margin-left: 6px;
		padding: 1px 6px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-chip);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-2);
	}
</style>
