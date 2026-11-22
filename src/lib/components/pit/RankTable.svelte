<script lang="ts">
	import Term from '#lib/ui/Term.svelte';
	import { fixed } from '#lib/format/number.ts';
	import { record } from '#lib/format/record.ts';
	import type { RankRow } from './view.ts';

	interface Props {
		rows: RankRow[];
		team: number;
		names: Map<number, string>;
		caption: string;
	}

	let { rows, team, names, caption }: Props = $props();
</script>

<table class="rank">
	<caption class="visually-hidden">{caption}</caption>
	<thead>
		<tr>
			<th class="l" scope="col"><Term label="#" /></th>
			<th class="l" scope="col">Team</th>
			<th class="l" scope="col"><span class="visually-hidden">Name</span></th>
			<th scope="col"><Term label="RS" /></th>
			<th scope="col"><Term label="Record" /></th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row, index (row ? row.team : `gap-${index}`)}
			{#if row}
				<tr class={{ me: row.team === team }}>
					<td class="l">{row.rank}</td>
					<td class="l">{row.team}</td>
					<td class="name">{names.get(row.team) ?? ''}</td>
					<td>{fixed(row.rs, 2)}</td>
					<td>{record(row.wins, row.losses, row.ties)}</td>
				</tr>
			{:else}
				<tr class="gap" aria-hidden="true">
					<td class="l" colspan="5">…</td>
				</tr>
			{/if}
		{/each}
	</tbody>
</table>

<style>
	.rank {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.72em;
		font-variant-numeric: tabular-nums;
	}

	th {
		padding: 0 0.5em 0.4em;
		border-bottom: 1px solid var(--line-2);
		color: var(--text-3);
		font-weight: 500;
		text-align: right;
	}

	td {
		padding: 0.26em 0.5em;
		border-bottom: 1px solid var(--line);
		text-align: right;
		white-space: nowrap;
	}

	.l {
		text-align: left;
	}

	.name {
		max-width: 9em;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: left;
		color: var(--text-2);
	}

	.me {
		background: var(--accent);
	}

	.me td {
		color: var(--on-accent);
		font-weight: 600;
	}

	.me .name {
		color: var(--on-accent);
	}

	.gap td {
		color: var(--text-3);
		padding-block: 0.1em;
	}
</style>
