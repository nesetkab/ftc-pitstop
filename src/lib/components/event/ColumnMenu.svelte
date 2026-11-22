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
	}

	let { choice, sources, onchoose }: Props = $props();

	let open = $state(false);
	let root = $state<HTMLElement>();
	let trigger = $state<HTMLButtonElement>();
	const id = $props.id();

	const selected = $derived(new Set<string>(choice.columns));
	const groups = $derived(
		COLUMN_GROUPS.map((group) => ({
			...group,
			available: sources.has(group.source),
			columns: RANKING_COLUMNS.filter((column) => column.source === group.source)
		}))
	);
	const shown = $derived(
		choice.columns.filter((key) =>
			sources.has(RANKING_COLUMNS.find((column) => column.key === key)?.source ?? 'ranking')
		).length
	);

	function close(focus = false) {
		open = false;
		if (focus) trigger?.focus();
	}

	function onkeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			event.preventDefault();
			close(true);
		}
	}

	function onpointerdown(event: PointerEvent) {
		if (open && root && !root.contains(event.target as Node)) close();
	}

	function onfocusout(event: FocusEvent) {
		const next = event.relatedTarget as Node | null;
		if (next && root && !root.contains(next)) close();
	}

	function toggle(key: ColumnKey, on: boolean) {
		onchoose(toggleColumn(choice, key, on));
	}
</script>

<svelte:window {onpointerdown} />

<div class="menu" bind:this={root} {onkeydown} {onfocusout} role="presentation">
	<button
		bind:this={trigger}
		class="trigger"
		type="button"
		aria-expanded={open}
		aria-controls={id}
		onclick={() => (open = !open)}
	>
		Columns <span class="count">{shown}</span>
		<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
			<path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
		</svg>
	</button>
	<div class="panel" {id} hidden={!open} role="group" aria-label="Choose columns">
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
			<Button variant="secondary" onclick={() => close(true)}>Done</Button>
		</div>
	</div>
</div>

<style>
	.menu {
		position: relative;
	}

	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 10px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		font: 500 13px/1 var(--font);
		cursor: pointer;
	}

	.trigger:hover {
		border-color: var(--text-3);
	}

	.trigger[aria-expanded='true'] svg {
		transform: rotate(180deg);
	}

	.count {
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.panel {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 5;
		display: grid;
		gap: 14px;
		width: min(560px, calc(100vw - 2 * var(--gutter)));
		padding: 14px 16px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-panel);
		background: var(--bg);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
	}

	.panel[hidden] {
		display: none;
	}

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
		.trigger {
			min-height: 40px;
		}

		label {
			min-height: 36px;
		}
	}
</style>
