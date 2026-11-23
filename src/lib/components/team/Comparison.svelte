<script lang="ts">
	import Term from '#lib/ui/Term.svelte';
	import { fixed, MISSING, ordinal } from '#lib/format/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Table from '#lib/ui/Table.svelte';
	import type { TeamComparisonRow } from './team-view.ts';

	interface Props {
		rows: TeamComparisonRow[];
	}

	let { rows }: Props = $props();
</script>

{#if rows.length === 0}
	<EmptyState title="No matches played yet this season.">
		Percentiles show here after the team's first event.
	</EmptyState>
{:else}
	<Table>
		<thead>
			<tr>
				<th class="l" scope="col"><span class="visually-hidden">Measure</span></th>
				<th scope="col"><Term label="OPR" /></th>
				<th scope="col">Percentile</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.key)}
				<tr class:nested={row.nested}>
					<td class="l">{row.label}</td>
					<td>{fixed(row.value)}</td>
					<td>{row.percentile === null ? MISSING : ordinal(row.percentile)}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
	<p class="note">Percentile is the share of teams this season with a lower value.</p>
{/if}

<style>
	tr.nested td:first-child {
		padding-left: 24px;
		color: var(--text-2);
	}
</style>
