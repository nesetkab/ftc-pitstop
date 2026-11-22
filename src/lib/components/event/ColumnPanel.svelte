<script lang="ts">
	import Button from '#lib/ui/Button.svelte';
	import {
		COLUMN_GROUPS,
		DEFAULT_COLUMNS,
		isDefaultColumns,
		RANKING_COLUMNS,
		toggleColumn,
		type ColumnKey,
		type ColumnSource,
		type RankingChoice
	} from './ranking-columns.ts';

	interface Props {
		choice: RankingChoice;
		sources: ReadonlySet<ColumnSource>;
		onchoose: (choice: RankingChoice) => void;
		ondone: () => void;
	}

	let { choice, sources, onchoose, ondone }: Props = $props();

	const selected = $derived(new Set<string>(choice.columns));
	const groups = $derived(
		COLUMN_GROUPS.map((group) => ({
			...group,
			available: sources.has(group.source),
			columns: RANKING_COLUMNS.filter((column) => column.source === group.source)
		}))
	);

	function toggle(key: ColumnKey, on: boolean) {
		onchoose(toggleColumn(choice, key, on));
	}
</script>

<div class="groups">
	{#each groups as group (group.source)}
		<fieldset class={group.source} disabled={!group.available}>
			<legend>{group.label}</legend>
			{#each group.columns as column (column.key)}
				<label>
					<input
						type="checkbox"
						checked={selected.has(column.key)}
						onchange={(event) => toggle(column.key, event.currentTarget.checked)}
					/>
					{column.name}
				</label>
			{/each}
			{#if group.source === 'score' && group.available}
				<p class="note">Without points from opponent fouls.</p>
			{/if}
			{#if !group.available}
				<p class="note">
					{group.source === 'rating'
						? 'Shows once the model has rated this event.'
						: 'Shows once qualification matches have scores.'}
				</p>
			{/if}
		</fieldset>
	{/each}
</div>
<div class="foot">
	<Button
		variant="secondary"
		disabled={isDefaultColumns(choice.columns)}
		onclick={() => onchoose({ ...choice, columns: DEFAULT_COLUMNS })}>Reset columns</Button
	>
	<Button variant="secondary" onclick={ondone}>Done</Button>
</div>

<style>
	.groups {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 14px 20px;
	}

	fieldset {
		display: grid;
		gap: 2px;
		align-content: start;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: 6px;
		padding: 0;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--text-3);
	}

	label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 24px;
		padding: 3px 0;
		font-size: 14px;
		cursor: pointer;
	}

	fieldset:disabled label {
		color: var(--text-3);
		cursor: not-allowed;
	}

	input {
		width: 15px;
		height: 15px;
		margin: 0;
		accent-color: var(--text);
	}

	fieldset .note {
		margin: 4px 0 0;
		font-size: 12.5px;
	}

	.foot {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding-top: 12px;
		border-top: 1px solid var(--line);
	}

	@media (max-width: 600px) {
		fieldset.rating {
			grid-template-columns: 1fr 1fr;
			column-gap: 20px;
		}

		fieldset.rating .note {
			grid-column: 1 / -1;
		}
	}

	@media (pointer: coarse) {
		label {
			min-height: 36px;
		}
	}
</style>
