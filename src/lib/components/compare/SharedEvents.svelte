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
			<th class="l" scope="col">Event</th>
			{#each teams as team (team.number)}
				<th scope="col">{team.number}</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each events as event (event.code)}
			<tr>
				<td class="l event">
					<a href="/events/{event.code}">{event.name}</a>
					<span class="date">{shortDate(event.start)}</span>
				</td>
				{#each event.cells as cell, index (index)}
					<td class:dim={!cell.attending || cell.record === null}>
						<span class="line">{line(cell)}</span>
						{#if cell.opr !== null}
							<span class="sub">OPR {fixed(cell.opr)}</span>
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

	.date,
	.sub {
		display: block;
		font-size: 12.5px;
		color: var(--text-3);
	}

	.sub {
		max-width: 220px;
		margin-left: auto;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
