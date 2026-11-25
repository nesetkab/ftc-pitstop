<script lang="ts">
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import Button from '#lib/ui/Button.svelte';
	import {
		RECORD_CONDITION_LIMIT,
		RECORD_GROUPS,
		RECORD_OPS,
		RECORD_PARTS,
		recordQuery,
		type RecordCondition,
		type RecordFilters,
		type RecordOp,
		type RecordPart
	} from './records.ts';

	interface Props {
		filters: RecordFilters;
		ondone: (focus?: boolean) => void;
	}

	let { filters, ondone }: Props = $props();

	interface Draft {
		id: number;
		stat: RecordPart;
		op: RecordOp;
		against: RecordPart | '';
		number: number | null;
	}

	let next = 0;

	function draft(condition?: RecordCondition): Draft {
		next += 1;
		if (!condition) return { id: next, stat: 'total', op: 'gte', against: '', number: null };
		const number = typeof condition.value === 'number';
		return {
			id: next,
			stat: condition.stat,
			op: condition.op,
			against: number ? '' : (condition.value as RecordPart),
			number: number ? (condition.value as number) : null
		};
	}

	const start = untrack(() => filters);
	let rows = $state<Draft[]>(
		start.where.length > 0 ? start.where.map((entry) => draft(entry)) : [draft()]
	);
	let match = $state<'all' | 'any'>(start.match);

	const groups = RECORD_GROUPS.map((group) => ({
		...group,
		parts: RECORD_PARTS.filter((part) => part.group === group.key)
	}));

	function finished(row: Draft): RecordCondition | null {
		if (row.against) {
			return row.against === row.stat ? null : { stat: row.stat, op: row.op, value: row.against };
		}
		const value = row.number;
		if (value === null || !Number.isInteger(value) || Math.abs(value) > 9999) return null;
		return { stat: row.stat, op: row.op, value };
	}

	const ready = $derived(rows.map(finished).filter((row) => row !== null));

	function apply(where: RecordCondition[]) {
		goto(`/records${recordQuery({ ...filters, where, match }, 1)}`, { reset: false });
		ondone(true);
	}

	function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		apply(ready);
	}
</script>

<form {onsubmit}>
	{#if rows.length > 1}
		<label class="match">
			Show scores that meet
			<select bind:value={match}>
				<option value="all">all</option>
				<option value="any">any</option>
			</select>
			of these
		</label>
	{/if}
	<ol class="rows">
		{#each rows as row, index (row.id)}
			<li class="row">
				<select bind:value={row.stat} aria-label="Statistic {index + 1}">
					{#each groups as group (group.key)}
						<optgroup label={group.label}>
							{#each group.parts as part (part.key)}
								<option value={part.key}>{part.label}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
				<select class="op" bind:value={row.op} aria-label="Comparison {index + 1}">
					{#each RECORD_OPS as op (op.key)}
						<option value={op.key} title={op.name}>{op.label}</option>
					{/each}
				</select>
				<select bind:value={row.against} aria-label="Compare with {index + 1}">
					<option value="">a number</option>
					{#each groups as group (group.key)}
						<optgroup label={group.label}>
							{#each group.parts as part (part.key)}
								<option value={part.key} disabled={part.key === row.stat}>{part.label}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
				{#if row.against === ''}
					<input
						class="number"
						type="number"
						inputmode="numeric"
						step="1"
						min="-9999"
						max="9999"
						placeholder="0"
						aria-label="Number {index + 1}"
						bind:value={row.number}
					/>
				{/if}
				<button
					type="button"
					class="remove"
					aria-label="Remove condition {index + 1}"
					onclick={() =>
						(rows = rows.length > 1 ? rows.filter((entry) => entry !== row) : [draft()])}
				>
					<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
						<path d="M3.5 3.5 10.5 10.5M10.5 3.5 3.5 10.5" />
					</svg>
				</button>
			</li>
		{/each}
	</ol>
	<button
		type="button"
		class="add"
		disabled={rows.length >= RECORD_CONDITION_LIMIT}
		onclick={() => (rows = [...rows, draft()])}>Add condition</button
	>
	<p class="note">
		Compare any statistic with a number or with another statistic, like Auto more than Teleop.
	</p>
	<div class="foot">
		<Button variant="secondary" disabled={filters.where.length === 0} onclick={() => apply([])}
			>Clear all</Button
		>
		<Button type="submit" disabled={ready.length === 0}>Apply</Button>
	</div>
</form>

<style>
	form {
		display: grid;
		gap: 10px;
	}

	.match {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		color: var(--text-2);
	}

	.rows {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 56px minmax(0, 1fr) 80px 32px;
		align-items: center;
		gap: 6px;
	}

	.row:not(:has(.number)) select:nth-of-type(3) {
		grid-column: span 2;
	}

	select,
	.number {
		width: 100%;
		min-width: 0;
	}

	.number {
		padding: 7px 10px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-size: 14px;
		line-height: 1.4;
		font-variant-numeric: tabular-nums;
	}

	.number:hover {
		border-color: var(--text-3);
	}

	.remove {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-control);
		background: none;
		color: var(--text-3);
		cursor: pointer;
	}

	.remove:hover {
		background: var(--surface);
		color: var(--text);
	}

	.remove svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
	}

	.add {
		justify-self: start;
		padding: 4px 0;
		border: 0;
		background: none;
		color: var(--text);
		font: 500 13px/1.2 var(--font);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.add:disabled {
		color: var(--text-3);
		text-decoration: none;
		cursor: not-allowed;
	}

	.note {
		margin: 0;
		font-size: 12.5px;
		color: var(--text-3);
	}

	.foot {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding-top: 12px;
		border-top: 1px solid var(--line);
	}

	@media (max-width: 600px) {
		.row {
			grid-template-columns: minmax(0, 1fr) 56px 32px;
		}

		.row select:nth-of-type(3) {
			grid-column: 1 / 3;
		}

		.row:not(:has(.number)) select:nth-of-type(3) {
			grid-column: 1 / 3;
		}

		.row .remove {
			grid-column: 3;
			grid-row: 1;
		}

		.number {
			grid-column: 1 / 3;
		}
	}
	@media (pointer: coarse), (max-width: 600px) {
		.number {
			font-size: 16px;
		}
	}
</style>
