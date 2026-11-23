<script lang="ts">
	import Table from '#lib/ui/Table.svelte';
	import type { AdvancementRow } from './season-report.ts';
	import type { TeamAwardRow } from './team-view.ts';

	interface Props {
		rows: TeamAwardRow[];
		advancement?: AdvancementRow[];
	}

	let { rows, advancement = [] }: Props = $props();
</script>

{#if advancement.length > 0}
	<ul class="advancing">
		{#each advancement as row (row.code)}
			<li>
				Advanced to
				{#if row.toCode}<a href="/events/{row.toCode}">{row.to}</a>{:else}the next level{/if}
				from <a href="/events/{row.code}">{row.event}</a>
			</li>
		{/each}
	</ul>
{/if}

{#if rows.length > 0}
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
					<td class="l wrap">{row.name}</td>
					<td class="l wrap"><a href="/events/{row.code}">{row.event}</a></td>
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}

<style>
	.advancing {
		display: grid;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 15px;
		font-weight: 500;
	}
</style>
