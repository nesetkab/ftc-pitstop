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
		rowCurrent?: (row: T) => boolean;
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
		rowCurrent,
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

	function termOf(column: Column<T>) {
		return typeof column.term === 'string' ? column.term : undefined;
	}

	function arrow(column: Column<T>) {
		const next = nextSort(column, sort);
		return sort?.key === column.key ? sort.dir : next.dir;
	}
</script>

{#snippet words(column: Column<T>, text: string, nested: boolean)}
	{#if column.term}<Term
			label={text}
			term={termOf(column) ?? column.label}
			{nested}
		/>{:else}{text}{/if}
{/snippet}

{#snippet label(column: Column<T>, nested: boolean)}
	{#if column.short}<span class="long">{@render words(column, column.label, nested)}</span><span
			class="short"
			aria-hidden="true">{column.short}</span
		>{:else}{@render words(column, column.label, nested)}{/if}
{/snippet}

{#snippet sortLabel(column: Column<T>)}
	{#if column.numeric}<Arrow
			dir={arrow(column) === 'asc' ? 'up' : 'down'}
			class="sort-arrow"
		/>{/if}<span>{@render label(column, true)}</span>{#if !column.numeric}<Arrow
			dir={arrow(column) === 'asc' ? 'up' : 'down'}
			class="sort-arrow"
		/>{/if}
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
									>{@render sortLabel(column)}</a
								>
							{:else}
								<button class="sort" type="button" onclick={() => (sort = nextSort(column, sort))}
									>{@render sortLabel(column)}</button
								>
							{/if}
						{:else}
							{@render label(column, false)}
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each shown as row (rowKey(row))}
				<tr class={rowClass?.(row)} aria-current={rowCurrent?.(row) ? 'true' : undefined}>
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
		display: inline-block;
		white-space: nowrap;
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
		margin: 0 3px 0 0;
		opacity: 0;
		transition: opacity 0.12s;
	}

	th.l :global(.sort-arrow) {
		margin: 0 0 0 3px;
	}

	.short {
		display: none;
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

		.long {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}

		.short {
			display: inline;
		}
	}
</style>
