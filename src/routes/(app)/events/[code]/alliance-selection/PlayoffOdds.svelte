<script lang="ts">
	import type { AllianceOdds } from '#lib/analysis/types.ts';
	import { pct } from '#lib/format/pct.ts';
	import Table from '#lib/ui/Table.svelte';
	import { oddsRows } from '#lib/workspace/selection.ts';

	interface Props {
		odds: AllianceOdds[];
	}

	let { odds }: Props = $props();

	const rows = $derived(oddsRows(odds));
</script>

<Table>
	<thead>
		<tr>
			<th class="l" scope="col"><span class="visually-hidden">Alliance</span></th>
			<th scope="col"><span class="visually-hidden">Chance to win the event</span></th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.label)}
			<tr>
				<td class="l">{row.label}</td>
				<td>{pct(row.chance)}</td>
			</tr>
		{/each}
	</tbody>
</Table>
