<script lang="ts">
	import { fixed } from '#lib/format/number.ts';
	import { record } from '#lib/format/record.ts';
	import type { Ranking } from '#lib/types.ts';
	import RowFit from './RowFit.svelte';
	import { isGap, rankWindow } from './view.ts';

	interface Props {
		rankings: Ranking[];
		team: number;
		names: Map<number, string>;
		caption: string;
	}

	let { rankings, team, names, caption }: Props = $props();
</script>

<RowFit count={rankings.length}>
	{#snippet children(shown)}
		<table class="rank">
			<caption class="visually-hidden">{caption}</caption>
			<thead>
				<tr>
					<th class="l" scope="col">#</th>
					<th class="l" scope="col">Team</th>
					<th class="l" scope="col"><span class="visually-hidden">Name</span></th>
					<th scope="col">RS</th>
					<th scope="col">Record</th>
				</tr>
			</thead>
			<tbody>
				{#each rankWindow(rankings, team, shown) as row, index (isGap(row) ? `gap-${index}` : row.team)}
					{#if isGap(row)}
						<tr class="gap">
							<td class="l" colspan="5">{row.hidden} more</td>
						</tr>
					{:else}
						<tr class={{ me: row.team === team }}>
							<td class="l">{row.rank}</td>
							<td class="l">{row.team}</td>
							<td class="name">{names.get(row.team) ?? ''}</td>
							<td>{fixed(row.rs, 2)}</td>
							<td>{record(row.wins, row.losses, row.ties)}</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{/snippet}
</RowFit>

<style>
	.rank {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}

	th {
		padding-inline: 0.5em;
		box-shadow: inset 0 -1px var(--line-2);
		color: var(--text-3);
		font-weight: 500;
		text-align: right;
		vertical-align: bottom;
	}

	td {
		padding-inline: 0.5em;
		box-shadow: inset 0 -1px var(--line);
		text-align: right;
		white-space: nowrap;
	}

	.l {
		text-align: left;
	}

	.name {
		width: 100%;
		max-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: left;
		color: var(--text-2);
	}

	.me td {
		background: var(--accent);
		box-shadow: 1px 0 var(--accent);
		color: var(--on-accent);
		font-weight: 600;
	}

	.gap td {
		color: var(--text-3);
	}
</style>
