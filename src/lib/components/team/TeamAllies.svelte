<script lang="ts">
	import { matchHref } from '#lib/components/event/matches.ts';
	import { fixed, integer, MISSING, record } from '#lib/format/index.ts';
	import Table from '#lib/ui/Table.svelte';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import Term from '#lib/ui/Term.svelte';
	import type { AllyRow } from './season-report.ts';

	interface Props {
		kind: 'partners' | 'opponents';
		rows: AllyRow[];
		total: number;
	}

	let { kind, rows, total }: Props = $props();

	const SHOWN = 6;
	let open = $state(false);

	const visible = $derived(open ? rows : rows.slice(0, SHOWN));
	const hidden = $derived(rows.length - SHOWN);
	const summary = $derived(
		kind === 'partners'
			? `${total} ${total === 1 ? 'partner' : 'partners'}, most matches together first.`
			: `${total} ${total === 1 ? 'opponent' : 'opponents'}, toughest first by season OPR.`
	);
</script>

<Table>
	<thead>
		<tr>
			<th class="l" scope="col">Team</th>
			<th scope="col">Matches</th>
			<th scope="col">
				<Term label={kind === 'partners' ? 'Record' : 'Record against'} term="Record" />
			</th>
			{#if kind === 'partners'}
				<th scope="col">Best score</th>
			{:else}
				<th scope="col"><Term label="Season OPR" /></th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each visible as row (row.team)}
			<tr>
				<td class="l team">
					<TeamChip number={row.team} href="/teams/{row.team}" />
					{#if row.name}<span class="name">{row.name}</span>{/if}
				</td>
				<td>{row.matches}</td>
				<td>{record(row.wins, row.losses, row.ties)}</td>
				{#if kind === 'partners'}
					<td>
						{#if row.best}
							<a
								href={matchHref(row.best.code, row.best)}
								title="{row.best.label} at {row.best.code}">{integer(row.best.score)}</a
							>
						{:else}
							{MISSING}
						{/if}
					</td>
				{:else}
					<td>
						{fixed(row.opr)}
						{#if row.rank !== null}<small>#{integer(row.rank)}</small>{/if}
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</Table>
<div class="foot">
	<p class="note">
		{summary}
		{#if open && total > rows.length}Top {rows.length} shown.{/if}
	</p>
	{#if hidden > 0}
		<button type="button" class="toggle" aria-expanded={open} onclick={() => (open = !open)}>
			{open ? 'Show fewer' : `Show ${hidden} more`}
		</button>
	{/if}
</div>

<style>
	.team {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
	}

	.name {
		overflow: hidden;
		max-width: 16em;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-2);
	}

	small {
		display: inline-block;
		min-width: 6ch;
		margin-left: 4px;
		font-size: 12px;
		color: var(--text-3);
		text-align: left;
	}

	.foot {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}

	.toggle {
		flex: none;
		padding: 0;
		border: 0;
		background: none;
		color: var(--text-2);
		font: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	.toggle:hover {
		color: var(--text);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	@media (pointer: coarse) {
		.toggle {
			margin-block: -12px;
			padding-block: 12px;
		}
	}

	@media (max-width: 600px) {
		.name {
			max-width: min(7em, 22vw);
		}

		small {
			display: none;
		}
	}
</style>
