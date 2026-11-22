<script lang="ts">
	import { fixed } from '#lib/format/index.ts';
	import { PART_LABELS } from '#lib/game/biobuzz.ts';
	import Table from '#lib/ui/Table.svelte';
	import type { TeamPartRow } from './team-view.ts';

	interface Props {
		rows: TeamPartRow[];
	}

	let { rows }: Props = $props();

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

<Table>
	<caption class="visually-hidden">OPR by scoring part at each event</caption>
	<thead>
		<tr>
			<th class="l" scope="col">Event</th>
			{#each columns as column (column.key)}
				<th scope="col" class={{ nested: column.nested, opt: column.opt }}>{column.label}</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.key)}
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
		{/each}
	</tbody>
</Table>
<p class="note">
	OPR for each part of the score. Hive, flower, garden and park are teleop points. Bold marks the
	team's best event for that part.
</p>

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
	tr.season td {
		border-bottom-color: var(--line-2);
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
