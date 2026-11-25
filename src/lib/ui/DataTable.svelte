<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import Arrow from './Arrow.svelte';
	import Table from './Table.svelte';
	import Term from './Term.svelte';
	import { nextSort, sortRows, type Column, type SortState } from './data-table.ts';

	interface Props {
		rows: readonly T[];
		columns: Column<T>[];
		rowKey: (row: T) => string;
		caption: string;
		sort?: SortState | null;
		href?: (sort: SortState) => string;
		rowClass?: (row: T) => string | undefined;
		empty?: Snippet;
		class?: string;
	}

	let {
		rows,
		columns,
		rowKey,
		caption,
		sort = $bindable(null),
		href,
		rowClass,
		empty,
		class: className
	}: Props = $props();

	const shown = $derived(href ? [...rows] : sortRows(rows, columns, sort));

	function ariaSort(column: Column<T>) {
		if (sort?.key !== column.key) return undefined;
		return sort.dir === 'asc' ? 'ascending' : 'descending';
	}

	function classes(column: Column<T>) {
		const active = sort?.key === column.key;
		return [
			column.numeric ? 'num' : 'l',
			column.class,
			{
				active,
				strong: column.strong,
				fill: column.fill,
				[`hide-${column.hide}`]: column.hide !== undefined && !active
			}
		];
	}

	function arrow(column: Column<T>) {
		const next = nextSort(column, sort);
		return sort?.key === column.key ? sort.dir : next.dir;
	}
</script>

{#snippet label(column: Column<T>)}
	{#if column.term}<Term label={column.label} nested />{:else}{column.label}{/if}
{/snippet}

{#if shown.length === 0 && empty}
	{@render empty()}
{:else}
	<Table class={['data', className].filter(Boolean).join(' ')}>
		<caption class="visually-hidden">{caption}</caption>
		<thead>
			<tr>
				{#each columns as column (column.key)}
					<th scope="col" class={classes(column)} aria-sort={ariaSort(column)} title={column.title}>
						{#if column.sort}
							{#if href}
								<a class="sort" href={href(nextSort(column, sort))} data-sveltekit-noscroll
									><Arrow dir={arrow(column) === 'asc' ? 'up' : 'down'} class="sort-arrow" /><span
										>{@render label(column)}</span
									></a
								>
							{:else}
								<button class="sort" type="button" onclick={() => (sort = nextSort(column, sort))}
									><Arrow dir={arrow(column) === 'asc' ? 'up' : 'down'} class="sort-arrow" /><span
										>{@render label(column)}</span
									></button
								>
							{/if}
						{:else if column.term}
							<Term label={column.label} />
						{:else}
							{column.label}
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each shown as row (rowKey(row))}
				<tr class={rowClass?.(row)}>
					{#each columns as column (column.key)}
						<td class={classes(column)}>
							{#if column.cell}
								{@render column.cell(row)}
							{:else}
								{column.text?.(row) ?? ''}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}

<style>
	th.num,
	td.num {
		width: 1%;
		padding-inline: 10px;
		font-variant-numeric: tabular-nums;
	}

	th.fill,
	td.fill {
		width: 100%;
	}

	.sort {
		position: relative;
		display: inline-block;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-decoration: none;
		cursor: pointer;
	}

	.sort:hover {
		color: var(--text);
		text-decoration: none;
	}

	th :global(.sort-arrow) {
		position: absolute;
		top: 50%;
		right: calc(100% + 2px);
		margin: 0;
		translate: 0 -50%;
		opacity: 0;
		transition: opacity 0.12s;
	}

	th .sort:hover :global(.sort-arrow),
	th .sort:focus-visible :global(.sort-arrow) {
		opacity: 0.6;
	}

	th.active {
		color: var(--text);
		font-weight: 600;
	}

	th.active :global(.sort-arrow) {
		opacity: 1;
	}

	td.active,
	td.strong {
		font-weight: 600;
	}

	tbody td {
		padding-block: 7px;
		line-height: 1.3;
	}

	@media (hover: none) {
		th :global(.sort-arrow) {
			opacity: 0.3;
		}
	}

	@media (max-width: 860px) {
		.hide-tablet {
			display: none;
		}
	}

	@media (max-width: 600px) {
		.hide-tablet,
		.hide-phone {
			display: none;
		}

		th.num,
		td.num {
			padding-inline: 8px;
		}
	}
</style>
