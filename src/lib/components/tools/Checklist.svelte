<script lang="ts">
	import '#lib/components/tools/controls.css';
	import type { Snippet } from 'svelte';
	import { time } from '#lib/format/time.ts';
	import Button from '#lib/ui/Button.svelte';
	import UndoBar from '#lib/components/tools/UndoBar.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { newId } from '#lib/workspace/code.ts';
	import {
		addItem,
		addItems,
		EXAMPLE_ITEMS,
		moveItem,
		progress,
		removeItem,
		renameItem,
		resetForNextMatch,
		restoreItem,
		toggleItem,
		undoReset
	} from '#lib/workspace/checklist.ts';
	import { normalizeInitials } from '#lib/workspace/recents.ts';
	import type { CheckItem, Checklist } from '#lib/workspace/schemas.ts';
	import { UndoOffer } from '#lib/workspace/undo.svelte.ts';

	interface Props {
		checklist: Checklist;
		initials?: string;
		oninitials?: (value: string) => void;
		update?: (change: (checklist: Checklist) => Checklist) => void;
		share?: Snippet;
	}

	let { checklist, initials = '', oninitials, update, share }: Props = $props();

	const id = $props.id();
	const undo = new UndoOffer();
	let editing = $state(false);
	let draft = $state('');
	let waiting = $state<string | null>(null);
	let initialsInput = $state<HTMLInputElement>();

	const counts = $derived(progress(checklist));
	const title = $derived(checklist.match ? `Before ${checklist.match}` : 'Before the next match');

	function check(itemId: string, who: string) {
		const stamp = Date.now();
		update?.((current) => toggleItem(current, itemId, who, stamp));
	}

	function toggle(itemId: string) {
		if (!initials) {
			waiting = itemId;
			initialsInput?.focus();
			return;
		}
		check(itemId, initials);
	}

	function changeInitials(event: Event & { currentTarget: HTMLInputElement }) {
		const value = normalizeInitials(event.currentTarget.value);
		event.currentTarget.value = value;
		oninitials?.(value);
		if (value && waiting) {
			check(waiting, value);
			waiting = null;
		}
	}

	function addOne(event: SubmitEvent) {
		event.preventDefault();
		const text = draft;
		const itemId = newId();
		draft = '';
		update?.((current) => addItem(current, itemId, text));
	}

	function addExamples() {
		const items = EXAMPLE_ITEMS.map((text) => ({ id: newId(), text }));
		update?.((current) => addItems(current, items));
	}

	function reset() {
		const stamp = Date.now();
		const before = checklist;
		const checked = counts.done > 0;
		update?.((current) => resetForNextMatch(current, stamp));
		if (checked) {
			undo.offer('Checks cleared for the next match.', () =>
				update?.((current) => undoReset(current, before, stamp))
			);
		}
	}

	function remove(item: CheckItem, index: number) {
		update?.((current) => removeItem(current, item.id));
		undo.offer('Item removed.', () => update?.((current) => restoreItem(current, item, index)));
	}

	function who(by: string[]): string {
		return by.length > 0 ? ` by ${by.join(', ')}` : '';
	}
</script>

{#snippet addForm(variant: 'primary' | 'secondary')}
	<form class="add" onsubmit={addOne}>
		<label class="visually-hidden" for="{id}-new">New item</label>
		<input
			id="{id}-new"
			class="ctl-input"
			placeholder="New item"
			maxlength="160"
			bind:value={draft}
		/>
		<Button {variant} icon="plus" type="submit">Add item</Button>
	</form>
{/snippet}

<section class="checklist" aria-label="Checklist">
	<div class="head">
		<div class="title">
			<h3 class="sec-title">{title}</h3>
			{#if checklist.items.length > 0}
				<span class="count">{counts.done} of {counts.total} checked</span>
			{/if}
		</div>
		{#if share}{@render share()}{/if}
	</div>

	{#if update}
		<div class="initials">
			<label class="ctl-label" for="{id}-initials">Your initials</label>
			<input
				bind:this={initialsInput}
				id="{id}-initials"
				class="ctl-input short"
				maxlength="3"
				autocomplete="off"
				value={initials}
				onchange={changeInitials}
				aria-invalid={waiting ? 'true' : undefined}
				aria-describedby="{id}-initials-note"
			/>
			<span
				id="{id}-initials-note"
				class={waiting ? 'ctl-error' : 'note'}
				role={waiting ? 'alert' : undefined}
			>
				{waiting ? 'Add your initials to check items.' : 'Saved on this device.'}
			</span>
		</div>
	{/if}

	{#if checklist.items.length === 0}
		{#if update}
			<EmptyState title="No items yet.">Add the steps your team does before each match.</EmptyState>
		{:else}
			<EmptyState title="No items yet." />
		{/if}
		{#if update}
			{@render addForm('primary')}
			<div class="ctl-row">
				<Button variant="secondary" onclick={addExamples}>Add example items</Button>
			</div>
		{/if}
	{:else}
		<ul class="items">
			{#each checklist.items as item, index (item.id)}
				<li class="item" class:done={item.at !== null}>
					{#if editing && update}
						<input
							class="ctl-input"
							aria-label="Item {index + 1}"
							maxlength="160"
							value={item.text}
							oninput={(event) => {
								const value = event.currentTarget.value;
								update((current) => renameItem(current, item.id, value));
							}}
						/>
						<span class="edit-actions">
							<button
								type="button"
								class="ctl-btn plain"
								disabled={index === 0}
								aria-label="Move item {index + 1} up"
								onclick={() => update((current) => moveItem(current, item.id, index - 1))}
							>
								Up
							</button>
							<button
								type="button"
								class="ctl-btn plain"
								disabled={index === checklist.items.length - 1}
								aria-label="Move item {index + 1} down"
								onclick={() => update((current) => moveItem(current, item.id, index + 1))}
							>
								Down
							</button>
							<button
								type="button"
								class="ctl-btn plain"
								aria-label="Remove item {index + 1}"
								onclick={() => remove(item, index)}
							>
								Remove
							</button>
						</span>
					{:else}
						<label class="check">
							<input
								type="checkbox"
								checked={item.at !== null}
								disabled={!update}
								onchange={(event) => {
									event.currentTarget.checked = item.at !== null;
									toggle(item.id);
								}}
							/>
							<span class="text">{item.text}</span>
						</label>
						{#if item.at !== null}
							<em class="by">{item.by ? `${item.by} ` : ''}{time(item.at)}</em>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>

		{#if update}
			<div class="ctl-row">
				<Button icon="refresh" onclick={reset}>Reset for next match</Button>
				<Button variant="secondary" aria-pressed={editing} onclick={() => (editing = !editing)}>
					{editing ? 'Done editing' : 'Edit items'}
				</Button>
			</div>
			{#if editing}
				{@render addForm('secondary')}
			{/if}
		{/if}
	{/if}

	{#if checklist.history.length > 0}
		<details class="history">
			<summary>Earlier matches</summary>
			<ul>
				{#each checklist.history as entry (entry.at)}
					<li>
						<b>{entry.match || 'Match'}</b>
						<span>{entry.done} of {entry.total} checked{who(entry.by)}</span>
						<em>{time(entry.at)}</em>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
	{#if update}<UndoBar offer={undo} />{/if}
</section>

<style>
	.checklist {
		display: grid;
		gap: 12px;
		align-content: start;
		min-width: 0;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
	}

	.title {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 12px;
	}

	.count {
		color: var(--text-2);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	.initials {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 10px;
	}

	.short {
		width: 72px;
		text-transform: uppercase;
	}

	.items {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 10px;
		align-items: center;
		padding: 9px 0;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
	}

	.check {
		display: grid;
		grid-template-columns: 22px minmax(0, 1fr);
		gap: 10px;
		align-items: center;
		min-height: 24px;
		cursor: pointer;
	}

	.check input {
		appearance: none;
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		margin: 0;
		border: 1.5px solid var(--line-2);
		border-radius: var(--radius-chip);
		background: var(--bg);
		cursor: pointer;
	}

	.check input:checked {
		border-color: var(--text);
		background: var(--text);
	}

	.check input:checked::after {
		content: '';
		width: 9px;
		height: 5px;
		border-bottom: 2px solid var(--bg);
		border-left: 2px solid var(--bg);
		transform: translate(0, -1px) rotate(-45deg);
	}

	.check input:disabled {
		cursor: default;
	}

	.check input:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}

	.done .text {
		color: var(--text-2);
	}

	.by {
		color: var(--text-3);
		font-size: 13px;
		font-style: normal;
		white-space: nowrap;
	}

	.edit-actions {
		display: flex;
		gap: 2px;
	}

	.add {
		display: flex;
		gap: 8px;
		max-width: 520px;
	}

	.history summary {
		cursor: pointer;
		font-size: 14px;
		color: var(--text-2);
	}

	.history ul {
		display: grid;
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
		font-size: 14px;
	}

	.history li {
		display: grid;
		grid-template-columns: 48px minmax(0, 1fr) auto;
		gap: 10px;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
		font-variant-numeric: tabular-nums;
	}

	.history span {
		color: var(--text-2);
	}

	.history em {
		color: var(--text-3);
		font-size: 13px;
		font-style: normal;
	}

	@media (max-width: 640px) {
		.item {
			grid-template-columns: minmax(0, 1fr);
			gap: 4px;
		}

		.by {
			padding-left: 32px;
		}

		.edit-actions {
			justify-content: flex-start;
		}
	}
</style>
