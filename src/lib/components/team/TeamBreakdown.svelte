<script lang="ts">
	import { oprTerm } from '#lib/format/glossary.ts';
	import Term from '#lib/ui/Term.svelte';
	import { fixed, MISSING, ordinal } from '#lib/format/index.ts';
	import { PART_LABELS } from '#lib/game/biobuzz.ts';
	import Table from '#lib/ui/Table.svelte';
	import type { TeamComparisonRow, TeamPartRow } from './team-view.ts';
	import Legend from '#lib/ui/Legend.svelte';

	interface Props {
		rows: TeamPartRow[];
		comparison?: TeamComparisonRow[];
	}

	let { rows, comparison = [] }: Props = $props();

	type Part = 'opr' | 'auto' | 'teleop' | 'hive' | 'flower' | 'garden' | 'park' | 'tips';

	const columns: { key: Part; label: string; nested?: boolean; opt?: boolean }[] = [
		{ key: 'opr', label: PART_LABELS.total },
		{ key: 'auto', label: PART_LABELS.auto },
		{ key: 'teleop', label: PART_LABELS.teleop },
		{ key: 'hive', label: PART_LABELS.hive, nested: true },
		{ key: 'flower', label: PART_LABELS.flower, nested: true, opt: true },
		{ key: 'garden', label: PART_LABELS.garden, nested: true, opt: true },
		{ key: 'park', label: PART_LABELS.park, nested: true, opt: true },
		{ key: 'tips', label: PART_LABELS.tips, opt: true }
	];

	const events = $derived(rows.filter((row) => row.code !== null));
	const season = $derived(rows.filter((row) => row.code === null));
	const percentiles = $derived(
		new Map(
			comparison.map((row) => [row.key === 'total' ? 'opr' : row.key, row.percentile] as const)
		)
	);
	const best = $derived(
		Object.fromEntries(
			columns.map(({ key }) => {
				const values = events.map((row) => row[key]).filter((value) => value !== null);
				const top = values.length > 0 ? Math.max(...values) : 0;
				return [key, events.length > 1 && top > 0 ? top : null];
			})
		) as Record<Part, number | null>
	);
</script>

{#snippet line(row: TeamPartRow)}
	<tr class:season={row.code === null}>
		<th class="l wrap" scope="row">
			{#if row.code}
				<a href="/events/{row.code}">{row.label}</a>
			{:else}
				{row.label}
			{/if}
		</th>
		{#each columns as column (column.key)}
			{@const value = row[column.key]}
			<td
				class={{
					nested: column.nested,
					opt: column.opt,
					best: row.code !== null && value !== null && value === best[column.key]
				}}>{fixed(value)}</td
			>
		{/each}
	</tr>
{/snippet}

<Table>
	<caption class="visually-hidden">OPR by scoring part at each event</caption>
	<thead>
		<tr>
			<th class="l" scope="col">Event</th>
			{#each columns as column (column.key)}
				<th scope="col" class={{ nested: column.nested, opt: column.opt }}
					><Term label={column.label} term={oprTerm(column.label)} /></th
				>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each season as row (row.key)}
			{@render line(row)}
		{/each}
		{#if comparison.length > 0}
			<tr class="percentile">
				<th class="l" scope="row">Season percentile</th>
				{#each columns as column (column.key)}
					{@const value = percentiles.get(column.key) ?? null}
					<td class={{ nested: column.nested, opt: column.opt }}>
						{value === null ? MISSING : ordinal(value)}
					</td>
				{/each}
			</tr>
		{/if}
		{#each events as row (row.key)}
			{@render line(row)}
		{/each}
	</tbody>
</Table>
<Legend>
	OPR for each part of the score. Hive, flower, garden and park are teleop points.
	{#if comparison.length > 0}Season percentile is the share of teams this season with a lower value.{/if}
	{#if events.length > 1}Bold marks the team's best event for that part.{/if}
</Legend>

<style>
	tbody th {
		padding: 9px 10px;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		font-weight: 400;
		color: var(--text);
		min-width: 10em;
	}

	tr.season th,
	tr.season td,
	tr.percentile th,
	tr.percentile td {
		border-bottom-color: var(--line-2);
	}

	tr.season:has(+ .percentile) th,
	tr.season:has(+ .percentile) td {
		border-bottom: 0;
	}

	tr.season + .percentile th,
	tr.season + .percentile td {
		padding-top: 0;
	}

	tr.percentile th,
	tr.percentile td {
		font-size: 13px;
		color: var(--text-3);
	}

	tr.season th {
		font-weight: 600;
	}

	th.nested,
	td.nested {
		color: var(--text-2);
	}

	td.best {
		font-weight: 600;
		color: var(--text);
	}
</style>
