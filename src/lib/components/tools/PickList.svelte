<script lang="ts">
	import '#lib/components/tools/controls.css';
	import { tick, type Snippet } from 'svelte';
	import UndoBar from '#lib/components/tools/UndoBar.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { parseEventCode, parseTeamNumber } from '#lib/workspace/code.ts';
	import {
		addEntry,
		avoided,
		checkAdd,
		indexAtOffset,
		moveEntry,
		pickListCsv,
		pickListText,
		ranked,
		removeEntry,
		restoreEntry,
		setAvoid,
		setEvent,
		setName,
		setNote,
		setTaken,
		statText,
		TAG_LABELS,
		tagText,
		toggleTag,
		type PickStat
	} from '#lib/workspace/picklist.ts';
	import { PICK_TAGS, type PickEntry, type PickList } from '#lib/workspace/schemas.ts';
	import { UndoOffer } from '#lib/workspace/undo.svelte.ts';

	interface Props {
		list: PickList;
		update?: (change: (list: PickList) => PickList) => void;
		auto?: ReadonlyMap<number, string>;
		stats?: ReadonlyMap<number, PickStat>;
		lookupName?: (team: number) => Promise<string | null>;
		share?: Snippet;
		title?: string;
		showEvent?: boolean;
		exportable?: boolean;
	}

	let {
		list,
		update,
		auto,
		stats,
		lookupName,
		share,
		title = 'Pick list',
		showEvent = true,
		exportable
	}: Props = $props();

	interface Drag {
		team: number;
		from: number;
		startY: number;
		startScroll: number;
		pointerY: number;
		offset: number;
		centers: number[];
		target: number;
	}

	const EDGE = 72;

	const id = $props.id();
	const undo = new UndoOffer();
	let draft = $state('');
	let error = $state('');
	let eventError = $state('');
	let announcement = $state('');
	let copied = $state(false);
	let open = $state<number | null>(null);
	let drag = $state.raw<Drag | null>(null);
	let listElement = $state<HTMLOListElement>();
	let root = $state<HTMLElement>();
	let frame = 0;

	const picks = $derived(ranked(list));
	const avoid = $derived(avoided(list));
	const eventHref = $derived(list.event ? `/events/${list.event}/alliance-selection` : null);
	const context = $derived({ labels: auto, stats });

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

	function moved(team: number, target: number, total: number) {
		announcement = `${team} moved to position ${target + 1} of ${total}.`;
	}

	function at(current: Drag, pointerY: number): Drag {
		const offset = pointerY - current.startY + window.scrollY - current.startScroll;
		return {
			...current,
			pointerY,
			offset,
			target: indexAtOffset(current.centers, current.from, offset)
		};
	}

	function edgeScroll() {
		if (!drag) return;
		const y = drag.pointerY;
		const bottom = window.innerHeight - EDGE;
		const speed = y < EDGE ? -(EDGE - y) / 4 : y > bottom ? (y - bottom) / 4 : 0;
		if (speed !== 0) {
			window.scrollBy(0, speed);
			drag = at(drag, y);
		}
		frame = requestAnimationFrame(edgeScroll);
	}

	function startDrag(event: PointerEvent, team: number, index: number) {
		if (!update || !listElement || (event.pointerType === 'mouse' && event.button !== 0)) return;
		const handle = event.currentTarget as HTMLElement;
		handle.setPointerCapture?.(event.pointerId);
		const centers = [...listElement.children].map((row) => {
			const box = row.getBoundingClientRect();
			return box.top + box.height / 2;
		});
		drag = {
			team,
			from: index,
			startY: event.clientY,
			startScroll: window.scrollY,
			pointerY: event.clientY,
			offset: 0,
			centers,
			target: index
		};
		frame = requestAnimationFrame(edgeScroll);
	}

	function moveDrag(event: PointerEvent) {
		if (drag) drag = at(drag, event.clientY);
	}

	function stopDrag() {
		cancelAnimationFrame(frame);
		const current = drag;
		drag = null;
		return current;
	}

	function endDrag() {
		const current = stopDrag();
		if (!current || current.target === current.from) return;
		update?.((list) => moveEntry(list, current.team, current.target));
		moved(current.team, current.target, picks.length);
	}

	async function focusHandle(team: number) {
		await tick();
		listElement?.querySelector<HTMLElement>(`[data-handle="${team}"]`)?.focus();
	}

	function move(team: number, index: number, target: number) {
		const last = picks.length - 1;
		const to = Math.min(Math.max(target, 0), last);
		if (!update || to === index) return;
		update((current) => moveEntry(current, team, to));
		moved(team, to, picks.length);
	}

	async function focusMore(team: number | undefined) {
		await tick();
		const more =
			team === undefined
				? null
				: root?.querySelector<HTMLElement>(`[aria-controls="${id}-more-${team}"]`);
		(more ?? document.getElementById(`${id}-team`))?.focus();
	}

	async function moveBy(button: HTMLButtonElement, team: number, index: number, target: number) {
		move(team, index, target);
		await tick();
		if (button.disabled) await focusHandle(team);
	}

	async function moveTop(team: number, index: number) {
		move(team, index, 0);
		await focusHandle(team);
	}

	async function pressKey(event: KeyboardEvent, team: number, index: number) {
		const targets: Record<string, number> = {
			ArrowUp: index - 1,
			ArrowDown: index + 1,
			Home: 0,
			End: picks.length - 1
		};
		const wanted = targets[event.key];
		if (wanted === undefined || !update) return;
		event.preventDefault();
		move(team, index, wanted);
		await focusHandle(team);
	}

	function remove(entry: PickEntry) {
		const index = list.entries.findIndex((item) => item.team === entry.team);
		const group = entry.avoid ? avoid : picks;
		const at = group.findIndex((item) => item.team === entry.team);
		const neighbor = group[at + 1] ?? group[at - 1];
		open = null;
		update?.((current) => removeEntry(current, entry.team));
		undo.offer(`Removed ${entry.team}.`, () =>
			update?.((current) => restoreEntry(current, entry, index))
		);
		focusMore(neighbor?.team);
	}

	function changeAvoid(entry: PickEntry) {
		const next = !entry.avoid;
		open = null;
		update?.((current) => setAvoid(current, entry.team, next));
		announcement = next
			? `${entry.team} moved to do not pick.`
			: `${entry.team} moved back to the pick list.`;
		focusMore(entry.team);
	}

	async function copyText() {
		copied = await navigator.clipboard.writeText(pickListText(list, context)).then(
			() => true,
			() => false
		);
		announcement = copied ? 'Pick list copied.' : 'Could not copy the pick list.';
		if (copied) setTimeout(() => (copied = false), 3000);
	}

	function downloadCsv() {
		const blob = new Blob([pickListCsv(list, context)], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `pick-list${list.event ? `-${list.event.toLowerCase()}` : ''}.csv`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
</script>

{#snippet row(entry: PickEntry, index: number, last: number)}
	{@const label = auto?.get(entry.team) ?? null}
	{@const gone = entry.taken || label !== null}
	{@const stat = statText(stats?.get(entry.team))}
	{@const unrated = stats?.get(entry.team)?.season === true && !stat}
	{@const tags = tagText(entry)}
	{@const avoiding = Boolean(entry.avoid)}
	<li
		class={[
			'row',
			{
				gone,
				dragging: drag?.team === entry.team,
				before: drag !== null && drag.target < drag.from && drag.target === index,
				after: drag !== null && drag.target > drag.from && drag.target === index
			}
		]}
		style:transform={drag?.team === entry.team ? `translateY(${drag.offset}px)` : undefined}
	>
		{#if update && !avoiding}
			<button
				type="button"
				class="handle"
				data-handle={entry.team}
				aria-label="Move {entry.team}"
				aria-describedby="{id}-help"
				onpointerdown={(event) => startDrag(event, entry.team, index)}
				onpointermove={moveDrag}
				onpointerup={endDrag}
				onpointercancel={stopDrag}
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
		{#if update && avoiding}<span class="handle" aria-hidden="true"></span>{/if}
		<span class="rank">{avoiding ? '' : index + 1}</span>
		<span class="team"
			><b>{entry.team}</b>{#if entry.name}<span class="name">{entry.name}</span>{/if}</span
		>
		<span class="meta"
			>{#if stat}<span class="stat">{stat}</span>{:else if unrated}<span
					class="stat faint"
					title="Not at this event and no season OPR yet"
					><span aria-hidden="true">—</span><span class="visually-hidden"
						>Not at this event, no season OPR yet</span
					></span
				>{/if}{#if tags}<span class="tags">{tags}</span>{/if}</span
		>
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
		{#if update && !avoiding}
			<span class="move">
				<button
					type="button"
					class="ctl-btn plain icon"
					aria-label="Move {entry.team} up"
					disabled={index === 0}
					onclick={(event) => moveBy(event.currentTarget, entry.team, index, index - 1)}
				>
					<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
						<path d="M2.5 7.5 6 4l3.5 3.5" />
					</svg>
				</button>
				<button
					type="button"
					class="ctl-btn plain icon"
					aria-label="Move {entry.team} down"
					disabled={index === last}
					onclick={(event) => moveBy(event.currentTarget, entry.team, index, index + 1)}
				>
					<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
						<path d="M2.5 4.5 6 8l3.5-3.5" />
					</svg>
				</button>
			</span>
		{/if}
		<span class="actions">
			{#if label}
				<span class="tag">{label}</span>
			{:else if update && !avoiding}
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
					aria-expanded={open === entry.team}
					aria-controls="{id}-more-{entry.team}"
					aria-label="More for {entry.team}"
					onclick={() => (open = open === entry.team ? null : entry.team)}
				>
					More
				</button>
			{/if}
		</span>
		{#if update && open === entry.team}
			<div class="more" id="{id}-more-{entry.team}">
				<div class="chips" role="group" aria-label="Tags for {entry.team}">
					{#each PICK_TAGS as tag (tag)}
						<button
							type="button"
							class="ctl-btn"
							aria-pressed={entry.tags?.includes(tag) ?? false}
							onclick={() => update((current) => toggleTag(current, entry.team, tag))}
						>
							{TAG_LABELS[tag]}
						</button>
					{/each}
				</div>
				<div class="ctl-row">
					{#if !avoiding && index > 0}
						<button type="button" class="ctl-btn" onclick={() => moveTop(entry.team, index)}>
							Move to top
						</button>
					{/if}
					<button type="button" class="ctl-btn" onclick={() => changeAvoid(entry)}>
						{avoiding ? 'Back to pick list' : 'Do not pick'}
					</button>
					<button type="button" class="ctl-btn" onclick={() => remove(entry)}>
						Remove {entry.team}
					</button>
				</div>
			</div>
		{/if}
	</li>
{/snippet}

<section class="picklist" aria-label={title} bind:this={root}>
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
		{#if picks.length > 0}
			<ol class={['rows', { editable: Boolean(update) }]} bind:this={listElement}>
				{#each picks as entry, index (entry.team)}
					{@render row(entry, index, picks.length - 1)}
				{/each}
			</ol>
		{/if}
		{#if avoid.length > 0}
			<h4 class="sub">Do not pick</h4>
			<ul class={['rows', 'avoid', { editable: Boolean(update) }]}>
				{#each avoid as entry, index (entry.team)}
					{@render row(entry, index, avoid.length - 1)}
				{/each}
			</ul>
		{/if}
		{#if update}
			<p id="{id}-help" class="note">
				Drag the handle or use the arrow buttons to reorder. With the handle focused, you can also
				press the up or down arrow key. Tags, do not pick and remove are under More.
			</p>
		{/if}
		{#if exportable ?? Boolean(update)}
			<div class="export">
				<button type="button" class="ctl-btn" onclick={copyText}>
					{copied ? 'Copied' : 'Copy as text'}
				</button>
				<button type="button" class="ctl-btn" onclick={downloadCsv}>Download CSV</button>
			</div>
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
			<p class="note">
				With an event code, each team shows its OPR and rank, and teams are crossed out as alliances
				pick them.
			</p>
		{/if}
	{/if}

	<p class="visually-hidden" role="status" aria-live="polite">{announcement}</p>
	{#if update}<UndoBar offer={undo} />{/if}
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

	.sub {
		margin-top: 8px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-2);
	}

	.rows {
		display: grid;
		grid-template-columns: 0 26px minmax(120px, 0.8fr) auto minmax(0, 1.2fr) auto auto;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.rows:not(.editable) .row {
		margin-left: -8px;
	}

	.rows.editable {
		grid-template-columns: auto 26px minmax(120px, 0.8fr) auto minmax(0, 1.2fr) auto auto;
	}

	.row {
		position: relative;
		display: grid;
		grid-template-columns: subgrid;
		grid-column: 1 / -1;
		column-gap: 8px;
		align-items: center;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
		background: var(--bg);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	.row > * {
		grid-row: 1;
	}

	.handle {
		grid-column: 1;
	}

	.rank {
		grid-column: 2;
	}

	.team {
		grid-column: 3;
	}

	.meta {
		display: contents;
	}

	.stat {
		grid-column: 4;
		grid-row: 1;
	}

	.tags {
		grid-column: 3;
		grid-row: 2;
	}

	.note-input,
	.note-text {
		grid-column: 5;
	}

	.move {
		grid-column: 6;
	}

	.actions {
		grid-column: 7;
	}

	.row > .more {
		grid-column: 2 / -1;
		grid-row: 3;
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

	span.handle {
		cursor: auto;
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
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.team b {
		font-weight: 600;
	}

	.name {
		margin-left: 6px;
		color: var(--text-2);
		font-size: 13px;
	}

	.tags {
		color: var(--text-2);
		font-size: 12px;
	}

	.stat {
		color: var(--text-2);
		font-size: 13px;
		white-space: nowrap;
	}

	.stat.faint {
		color: var(--text-3);
	}

	.note-input {
		font-size: 13px;
		color: var(--text-2);
	}

	.note-text {
		color: var(--text-2);
		font-size: 13px;
	}

	.move,
	.actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 4px;
	}

	.icon {
		width: 32px;
		padding: 6px 0;
	}

	.icon path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.tag {
		padding: 0 6px;
		color: var(--text-3);
		font-size: 13px;
		white-space: nowrap;
	}

	.more {
		display: grid;
		gap: 10px;
		padding: 8px 0 6px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.gone .team b,
	.gone .name,
	.gone .note-text,
	.gone .note-input:not(:placeholder-shown),
	.gone .rank {
		color: var(--text-3);
		text-decoration: line-through;
	}

	.avoid .team b {
		color: var(--text-2);
	}

	.export {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
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

	@container (max-width: 560px) {
		.rows,
		.rows.editable {
			grid-template-columns: minmax(0, 1fr);
		}

		.rows:not(.editable) .row {
			margin-left: 0;
		}

		.row {
			grid-column: auto;
			grid-template-columns: 22px minmax(0, 1fr) auto;
			grid-template-areas:
				'rank team team'
				'. meta meta'
				'. note actions'
				'. more more';
			row-gap: 2px;
			padding: 8px 0;
		}

		.row > * {
			grid-row: auto;
			grid-column: auto;
		}

		.editable .row {
			grid-template-columns: auto 22px minmax(0, 1fr) auto auto;
			grid-template-areas:
				'handle rank team team move'
				'. . meta meta meta'
				'. . note actions actions'
				'. . more more more';
		}

		.meta {
			display: flex;
			flex-wrap: wrap;
			gap: 0 10px;
			grid-area: meta;
		}

		.meta:empty {
			display: none;
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

		.move {
			grid-area: move;
		}

		.actions {
			grid-area: actions;
		}

		.note-input,
		.note-text {
			grid-area: note;
		}

		.row > .more {
			grid-area: more;
		}

		.note-text:empty {
			display: none;
		}
	}

	@media (pointer: coarse) {
		.handle {
			width: 28px;
			height: 44px;
		}

		.icon {
			width: 40px;
		}
	}
</style>
