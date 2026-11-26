<script lang="ts">
	import { fixed } from '#lib/format/number.ts';
	import { record } from '#lib/format/record.ts';
	import type { Ranking } from '#lib/types.ts';
	import { autoScroll } from './auto-scroll.ts';

	interface Props {
		rankings: Ranking[];
		team: number;
		names: Map<number, string>;
		caption: string;
	}

	let { rankings, team, names, caption }: Props = $props();

	let looping = $state(false);
</script>

<div class="wrap">
	<table class="rank" aria-hidden="true">
		{@render columns()}
		<thead>
			<tr>
				<th class="l">#</th>
				<th class="l">Team</th>
				<th></th>
				<th>RS</th>
				<th>Record</th>
			</tr>
		</thead>
	</table>
	<div class="box" {@attach autoScroll((value) => (looping = value))}>
		{@render table(false)}
		{#if looping}
			{@render table(true)}
		{/if}
	</div>
</div>

{#snippet columns()}
	<colgroup>
		<col class="place" />
		<col class="number" />
		<col />
		<col class="score" />
		<col class="wins" />
	</colgroup>
{/snippet}

{#snippet table(hidden: boolean)}
	<table class="rank" aria-hidden={hidden}>
		<caption class="visually-hidden">{caption}: rank, team, name, RS, record</caption>
		{@render columns()}
		<tbody>
			{#each rankings as row (row.team)}
				<tr class={{ me: row.team === team }}>
					<td class="l">{row.rank}</td>
					<td class="l">{row.team}</td>
					<td class="name">{names.get(row.team) ?? ''}</td>
					<td>{fixed(row.rs, 2)}</td>
					<td>{record(row.wins, row.losses, row.ties)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/snippet}

<style>
	.wrap {
		display: grid;
		grid-template: auto minmax(0, 1fr) / minmax(0, 1fr);
		min-height: 0;
		container-type: inline-size;
	}

	.box {
		min-height: 0;
		overflow: hidden auto;
	}

	.rank {
		width: 100%;
		table-layout: fixed;
		font-size: min(0.85em, 4.5cqi);
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}

	.place {
		width: 2.8em;
	}

	.number {
		width: 4.6em;
	}

	.score {
		width: 3.8em;
	}

	.wins {
		width: 5.2em;
	}

	th,
	td {
		height: 1.75em;
		padding-inline: 0.5em;
		text-align: right;
		white-space: nowrap;
	}

	th {
		box-shadow: inset 0 -1px var(--line-2);
		color: var(--text-3);
		font-weight: 500;
		vertical-align: bottom;
	}

	td {
		box-shadow: inset 0 -1px var(--line);
	}

	.l {
		text-align: left;
	}

	.name {
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
</style>
