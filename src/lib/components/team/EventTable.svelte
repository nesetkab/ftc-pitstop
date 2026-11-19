<script lang="ts">
	import Button from '#lib/ui/Button.svelte';
	import Table from '#lib/ui/Table.svelte';
	import type { HomeEvent } from './home.ts';

	interface Props {
		rows: HomeEvent[];
		caption: string;
		datesHeader: string;
		statusHeader: string;
		limit?: number;
	}

	let { rows, caption, datesHeader, statusHeader, limit = 12 }: Props = $props();

	let expanded = $state(false);

	const shown = $derived(expanded ? rows : rows.slice(0, limit));
</script>

<Table>
	<caption class="visually-hidden">{caption}</caption>
	<thead>
		<tr>
			<th class="l" scope="col">Event</th>
			<th class="l" scope="col">Where</th>
			<th class="l" scope="col">Type</th>
			<th class="l" scope="col">{datesHeader}</th>
			<th class="l" scope="col">{statusHeader}</th>
		</tr>
	</thead>
	<tbody>
		{#each shown as row (row.code)}
			<tr>
				<td class="l"><a href="/events/{row.code}">{row.name}</a></td>
				<td class="l">{row.place}</td>
				<td class="l">{row.type}</td>
				<td class="l">{row.dates}</td>
				<td class="l">{row.status}</td>
			</tr>
		{/each}
	</tbody>
</Table>

{#if rows.length > limit}
	<div class="more">
		<Button variant="secondary" aria-expanded={expanded} onclick={() => (expanded = !expanded)}>
			{expanded ? 'Show fewer' : `Show all ${rows.length}`}
		</Button>
	</div>
{/if}

<style>
	.more {
		display: flex;
	}
</style>
