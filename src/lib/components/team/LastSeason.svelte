<script lang="ts">
	import { fixed, integer } from '#lib/format/index.ts';
	import Table from '#lib/ui/Table.svelte';
	import type { PreviousSeason } from './team-view.ts';

	interface Props {
		previous: PreviousSeason;
	}

	let { previous }: Props = $props();
</script>

<Table>
	<thead>
		<tr>
			<th class="l" scope="col"><span class="visually-hidden">Measure</span></th>
			<th scope="col">OPR</th>
			<th scope="col">World rank</th>
		</tr>
	</thead>
	<tbody>
		{#each previous.rows as row (row.key)}
			<tr>
				<td class="l">{row.label}</td>
				<td>{fixed(row.value)}</td>
				<td>{integer(row.rank)} of {integer(previous.count)}</td>
			</tr>
		{/each}
	</tbody>
</Table>
<p class="note">Each value is the team's best event that season.</p>
