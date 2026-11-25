<script lang="ts">
	import Brand from '#lib/ui/Brand.svelte';
	import Table from '#lib/ui/Table.svelte';
	import type { HomeEvent } from './home.ts';

	interface Props {
		rows: HomeEvent[];
		caption: string;
	}

	let { rows, caption }: Props = $props();
</script>

<div class="events">
	<Table>
		<caption class="visually-hidden">{caption}</caption>
		<colgroup>
			<col class="event" />
			<col class="where" />
			<col class="type" />
			<col class="dates" />
		</colgroup>
		<thead>
			<tr>
				<th class="l" scope="col">Event</th>
				<th class="l where" scope="col">Where</th>
				<th class="l type" scope="col">Type</th>
				<th class="l" scope="col">Dates</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.code)}
				<tr>
					<td class="l name">
						<a href="/events/{row.code}"><Brand text={row.name} /></a>
						<span class="sub">{row.place}</span>
					</td>
					<td class="l where">{row.place}</td>
					<td class="l type">{row.type}</td>
					<td class="l dates">{row.dates}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
</div>

<style>
	.events :global(td) {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	col.event {
		width: 44%;
	}

	col.where {
		width: 26%;
	}

	col.type {
		width: 16%;
	}

	col.dates {
		width: 14%;
	}

	.sub {
		display: none;
		font-size: 13px;
		color: var(--text-2);
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

		col.dates {
			width: 1%;
		}

		.where,
		.type,
		col.where,
		col.type {
			display: none;
		}
	}
</style>
