<script lang="ts">
	import '#lib/components/tools/controls.css';
	import { tick, type Snippet } from 'svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { parseEventCode, parseTeamNumber } from '#lib/workspace/code.ts';
	import {
		addEntry,
		checkAdd,
		indexAtOffset,
		moveEntry,
		removeEntry,
		setEvent,
		setName,
		setNote,
		setTaken
	} from '#lib/workspace/picklist.ts';
	import type { PickList } from '#lib/workspace/schemas.ts';

	interface Props {
		list: PickList;
		update?: (change: (list: PickList) => PickList) => void;
		auto?: ReadonlyMap<number, string>;
		lookupName?: (team: number) => Promise<string | null>;
		share?: Snippet;
		title?: string;
		showEvent?: boolean;
	}

	let {
		list,
		update,
		auto,
		lookupName,
		share,
		title = 'Pick list',
		showEvent = true
	}: Props = $props();

	interface Drag {
		team: number;
		from: number;
		startY: number;
		offset: number;
		centers: number[];
		target: number;
	}

	const id = $props.id();
	let draft = $state('');
	let error = $state('');
	let eventError = $state('');
	let announcement = $state('');
	let drag = $state.raw<Drag | null>(null);
	let listElement = $state<HTMLOListElement>();

	const eventHref = $derived(list.event ? `/events/${list.event}/alliance-selection` : null);

	function add(event: SubmitEvent) {
		event.preventDefault();
		const team = parseTeamNumber(draft);
		if (team === null) {
			error = 'Enter a team number, 1 to 6 digits.';
			return;
		}
		const status = checkAdd(list, team);
		if (status === 'duplicate') {
			error = `${team} is already on the list.`;
			return;
		}
		if (status === 'full') {
			error = 'The list is full. Remove a team first.';
			return;
		}
		error = '';
		draft = '';
		update?.((current) => addEntry(current, team));
		void lookupName?.(team)
			.then((name) => {
				if (name) update?.((current) => setName(current, team, name));
			})
			.catch(() => undefined);
	}

	function changeEvent(event: Event & { currentTarget: HTMLInputElement }) {
		const value = event.currentTarget.value.trim();
		if (value === '') {
			eventError = '';
			update?.((current) => setEvent(current, null));
			return;
		}
		const code = parseEventCode(value);
		if (code === null) {
			eventError = 'Event codes use letters and numbers, like USAZGIQ.';
			return;
		}
		eventError = '';
		update?.((current) => setEvent(current, code));
	}

	function startDrag(event: PointerEvent, team: number, index: number) {
		if (!update || !listElement || (event.pointerType === 'mouse' && event.button !== 0)) return;
		const handle = event.currentTarget as HTMLElement;
		handle.setPointerCapture?.(event.pointerId);
		const centers = [...listElement.children].map((row) => {
			const box = row.getBoundingClientRect();
			return box.top + box.height / 2;
		});
		drag = { team, from: index, startY: event.clientY, offset: 0, centers, target: index };
	}

	function moveDrag(event: PointerEvent) {
		if (!drag) return;
		const offset = event.clientY - drag.startY;
		drag = { ...drag, offset, target: indexAtOffset(drag.centers, drag.from, offset) };
	}

	function endDrag() {
		if (!drag) return;
		const { team, from, target } = drag;
		drag = null;
		if (target !== from) {
			update?.((current) => moveEntry(current, team, target));
			announcement = `${team} moved to position ${target + 1} of ${list.entries.length}.`;
		}
	}

	async function pressKey(event: KeyboardEvent, team: number, index: number) {
		const last = list.entries.length - 1;
		const targets: Record<string, number> = {
			ArrowUp: index - 1,
			ArrowDown: index + 1,
			Home: 0,
			End: last
		};
		const wanted = targets[event.key];
		if (wanted === undefined || !update) return;
		event.preventDefault();
		const target = Math.min(Math.max(wanted, 0), last);
		if (target === index) return;
		update((current) => moveEntry(current, team, target));
		announcement = `${team} moved to position ${target + 1} of ${list.entries.length}.`;
		await tick();
		listElement?.querySelector<HTMLElement>(`[data-handle="${team}"]`)?.focus();
	}
</script>

<section class="picklist" aria-label={title}>
	<div class="head">
		<h3 class="sec-title">{title}</h3>
		{#if share}{@render share()}{/if}
	</div>

	{#if update}
		<form class="add" onsubmit={add} novalidate>
			<label class="visually-hidden" for="{id}-team">Team number</label>
			<input
				id="{id}-team"
				class="ctl-input"
				inputmode="numeric"
				autocomplete="off"
				maxlength="6"
				placeholder="Team number"
				bind:value={draft}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? `${id}-error` : undefined}
			/>
			<Button type="submit">Add team</Button>
		</form>
		{#if error}
			<p id="{id}-error" class="ctl-error" role="alert">{error}</p>
		{/if}
	{/if}

	{#if list.entries.length === 0}
		<EmptyState title="No teams yet.">
			{update ? 'Add the teams you want to pick, best first.' : 'This list is empty.'}
		</EmptyState>
	{:else}
		<ol class="rows" bind:this={listElement}>
			{#each list.entries as entry, index (entry.team)}
				{@const label = auto?.get(entry.team) ?? null}
				{@const gone = entry.taken || label !== null}
				<li
					class={[
						'row',
						{
							gone,
							editable: Boolean(update),
							dragging: drag?.team === entry.team,
							before: drag !== null && drag.target < drag.from && drag.target === index,
							after: drag !== null && drag.target > drag.from && drag.target === index
						}
					]}
					style:transform={drag?.team === entry.team ? `translateY(${drag.offset}px)` : undefined}
				>
					{#if update}
						<button
							type="button"
							class="handle"
							data-handle={entry.team}
							aria-label="Move {entry.team}"
							aria-describedby="{id}-help"
							onpointerdown={(event) => startDrag(event, entry.team, index)}
							onpointermove={moveDrag}
							onpointerup={endDrag}
							onpointercancel={() => (drag = null)}
							onkeydown={(event) => pressKey(event, entry.team, index)}
						>
							<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
								<circle cx="2.5" cy="3" r="1.4" />
								<circle cx="7.5" cy="3" r="1.4" />
								<circle cx="2.5" cy="8" r="1.4" />
								<circle cx="7.5" cy="8" r="1.4" />
								<circle cx="2.5" cy="13" r="1.4" />
								<circle cx="7.5" cy="13" r="1.4" />
							</svg>
						</button>
					{/if}
					<span class="rank">{index + 1}</span>
					<span class="team">
						<b>{entry.team}</b>
						{#if entry.name}<span class="name">{entry.name}</span>{/if}
					</span>
					{#if update}
						<input
							class="ctl-input ctl-quiet note-input"
							aria-label="Note for {entry.team}"
							placeholder="Add a note"
							maxlength="300"
							value={entry.note}
							oninput={(event) => {
								const value = event.currentTarget.value;
								update((current) => setNote(current, entry.team, value));
							}}
						/>
					{:else}
						<span class="note-text">{entry.note}</span>
					{/if}
					<span class="actions">
						{#if label}
							<span class="tag">{label}</span>
						{:else if update}
							<button
								type="button"
								class="ctl-btn"
								aria-pressed={entry.taken}
								onclick={() => update((current) => setTaken(current, entry.team, !entry.taken))}
							>
								{entry.taken ? 'Taken' : 'Mark taken'}
							</button>
						{:else if entry.taken}
							<span class="tag">Taken</span>
						{/if}
						{#if update}
							<button
								type="button"
								class="ctl-btn plain"
								aria-label="Remove {entry.team}"
								onclick={() => update((current) => removeEntry(current, entry.team))}
							>
								Remove
							</button>
						{/if}
					</span>
				</li>
			{/each}
		</ol>
		{#if update}
			<p id="{id}-help" class="note">
				Drag the handle to reorder. With the handle focused, press the up or down arrow.
			</p>
		{/if}
	{/if}

	{#if showEvent && (update || list.event)}
		<div class="event">
			<label class="ctl-label" for="{id}-event">Event code</label>
			{#if update}
				<input
					id="{id}-event"
					class="ctl-input event-input"
					placeholder="USAZGIQ"
					autocomplete="off"
					maxlength="24"
					value={list.event ?? ''}
					onchange={changeEvent}
					aria-invalid={eventError ? 'true' : undefined}
				/>
			{:else}
				<span>{list.event}</span>
			{/if}
			{#if eventHref}
				<a href={eventHref}>Open alliance selection</a>
			{/if}
		</div>
		{#if eventError}
			<p class="ctl-error" role="alert">{eventError}</p>
		{:else if update}
			<p class="note">With an event code, teams are crossed out as alliances pick them.</p>
		{/if}
	{/if}

	<p class="visually-hidden" role="status" aria-live="polite">{announcement}</p>
</section>

<style>
	.picklist {
		container-type: inline-size;
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

	.add {
		display: flex;
		gap: 8px;
		max-width: 420px;
	}

	.add input {
		flex: 1 1 auto;
	}

	.rows {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		position: relative;
		display: grid;
		grid-template-columns: 26px minmax(120px, 0.7fr) minmax(0, 1.3fr) auto;
		gap: 8px;
		align-items: center;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
		background: var(--bg);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	.row.editable {
		grid-template-columns: 22px 26px minmax(120px, 0.7fr) minmax(0, 1.3fr) auto;
	}

	.row.dragging {
		z-index: 2;
		border-radius: var(--radius-control);
		background: var(--surface);
		box-shadow: 0 0 0 1px var(--line-2);
		cursor: grabbing;
	}

	.row.before {
		box-shadow: 0 -2px 0 var(--text);
	}

	.row.after {
		box-shadow: 0 2px 0 var(--text);
	}

	.handle {
		display: grid;
		place-items: center;
		width: 22px;
		height: 32px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-chip);
		background: transparent;
		color: var(--text-3);
		cursor: grab;
		touch-action: none;
	}

	.handle:hover {
		color: var(--text);
	}

	.handle circle {
		fill: currentColor;
	}

	.rank {
		color: var(--text-3);
		text-align: right;
	}

	.team {
		min-width: 0;
	}

	.team b {
		font-weight: 600;
	}

	.name {
		margin-left: 6px;
		color: var(--text-2);
		font-size: 13px;
	}

	.note-input {
		font-size: 13px;
		color: var(--text-2);
	}

	.note-text {
		color: var(--text-2);
		font-size: 13px;
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 4px;
	}

	.tag {
		padding: 0 6px;
		color: var(--text-3);
		font-size: 13px;
		white-space: nowrap;
	}

	.gone .team b,
	.gone .name,
	.gone .note-text,
	.gone .note-input,
	.gone .rank {
		color: var(--text-3);
		text-decoration: line-through;
	}

	.event {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		margin-top: 4px;
	}

	.event-input {
		width: 160px;
		text-transform: uppercase;
	}

	.event a {
		font-size: 14px;
	}

	@container (max-width: 520px) {
		.row {
			grid-template-columns: 22px minmax(0, 1fr) auto;
			grid-template-areas:
				'rank team actions'
				'note note note';
			padding: 8px 0;
		}

		.row.editable {
			grid-template-columns: 22px 22px minmax(0, 1fr) auto;
			grid-template-areas:
				'handle rank team actions'
				'. note note note';
		}

		.handle {
			grid-area: handle;
		}

		.rank {
			grid-area: rank;
		}

		.team {
			grid-area: team;
		}

		.actions {
			grid-area: actions;
		}

		.note-input,
		.note-text {
			grid-area: note;
		}

		.note-text:empty {
			display: none;
		}
	}
</style>
