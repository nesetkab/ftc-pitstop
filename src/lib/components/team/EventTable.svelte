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

<div class="events">
	<Table>
		<caption class="visually-hidden">{caption}</caption>
		<colgroup>
			<col class="event" />
			<col class="where" />
			<col class="type" />
			<col class="dates" />
			<col class="status" />
		</colgroup>
		<thead>
			<tr>
				<th class="l" scope="col">Event</th>
				<th class="l where" scope="col">Where</th>
				<th class="l type" scope="col">Type</th>
				<th class="l" scope="col">{datesHeader}</th>
				<th class="l" scope="col">{statusHeader}</th>
			</tr>
		</thead>
		<tbody>
			{#each shown as row (row.code)}
				<tr>
					<td class="l name">
						<a href="/events/{row.code}">{row.name}</a>
						<span class="sub">{row.place}</span>
					</td>
					<td class="l where">{row.place}</td>
					<td class="l type">{row.type}</td>
					<td class="l">{row.dates}</td>
					<td class="l">{row.status}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
</div>

{#if rows.length > limit}
	<div class="more">
		<Button variant="secondary" aria-expanded={expanded} onclick={() => (expanded = !expanded)}>
			{expanded ? 'Show fewer' : `Show all ${rows.length}`}
		</Button>
	</div>
{/if}

<style>
	.events :global(td) {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	col.event {
		width: 34%;
	}

	col.where {
		width: 20%;
	}

	col.type {
		width: 14%;
	}

	col.dates {
		width: 15%;
	}

	col.status {
		width: 17%;
	}

	.sub {
		display: none;
		font-size: 13px;
		color: var(--text-2);
	}

	.more {
		display: flex;
	}

	@media (min-width: 641px) {
		.events :global(table.t) {
			table-layout: fixed;
		}
	}

	@media (max-width: 640px) {
		.name {
			white-space: normal;
		}

		.sub {
			display: block;
		}

		col.event {
			width: auto;
		}

		col.dates,
		col.status {
			width: 1%;
		}

		.type,
		.where,
		col.type,
		col.where {
			display: none;
		}
	}
</style>
