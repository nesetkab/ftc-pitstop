<script lang="ts">
	import Brand from '#lib/ui/Brand.svelte';
	import Table from '#lib/ui/Table.svelte';
	import type { TeamAwardRow } from './team-view.ts';

	interface Props {
		rows: TeamAwardRow[];
	}

	let { rows }: Props = $props();
</script>

<Table>
	<thead>
		<tr>
			<th class="l" scope="col">Award</th>
			<th class="l" scope="col">Event</th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row, index (index)}
			<tr>
				<td class="l wrap"><Brand text={row.name} /></td>
				<td class="l wrap"><a href="/events/{row.code}">{row.event}</a></td>
			</tr>
		{/each}
	</tbody>
</Table>
