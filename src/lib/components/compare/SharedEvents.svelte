<script lang="ts">
	import { fixed, MISSING, ordinal, shortDate } from '#lib/format/index.ts';
	import Table from '#lib/ui/Table.svelte';
	import type { CompareTeam, SharedEvent, SharedEventCell } from './compare.ts';

	interface Props {
		teams: CompareTeam[];
		events: SharedEvent[];
	}

	let { teams, events }: Props = $props();

	function line(cell: SharedEventCell): string {
		if (!cell.attending) return MISSING;
		if (cell.record === null) return 'Registered';
		const rank = cell.rank === null ? '' : `${ordinal(cell.rank)}, `;
		return `${rank}${cell.record}`;
	}
</script>

<Table>
	<caption class="visually-hidden">Events where two or more of these teams were entered</caption>
	<thead>
		<tr>
			<th class="l pin" scope="col">Event</th>
			{#each teams as team (team.number)}
				<th scope="col">{team.number}</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each events as event (event.code)}
			<tr>
				<td class="l event pin">
					<a href="/events/{event.code}">{event.name}</a>
					<span class="date">{shortDate(event.start)}</span>
				</td>
				{#each event.cells as cell, index (index)}
					<td class:dim={!cell.attending || cell.record === null}>
						<span class="line">{line(cell)}</span>
						{#if cell.opr !== null}
							<span class="sub">aOPR {fixed(cell.opr)}</span>
						{/if}
						{#if cell.awards.length > 0}
							<span class="sub">{cell.awards.join(', ')}</span>
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</Table>

<style>
	.event {
		max-width: 300px;
	}

	.event a {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	td {
		vertical-align: top;
	}

	@media (min-width: 601px) {
		th:not(.pin),
		td:not(.pin) {
			width: 190px;
		}
	}

	.pin {
		position: sticky;
		left: 0;
		z-index: 1;
		background: var(--bg);
	}

	.date,
	.sub {
		display: block;
		font-size: 12.5px;
		color: var(--text-3);
	}

	.sub {
		max-width: 180px;
		margin-left: auto;
		white-space: normal;
	}

	@media (max-width: 600px) {
		.event {
			min-width: 120px;
			max-width: 120px;
			white-space: normal;
			box-shadow: inset -1px 0 var(--line);
		}

		th.pin {
			box-shadow: inset -1px 0 var(--line-2);
		}

		.event a {
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}

		.sub {
			max-width: 140px;
		}
	}
</style>
