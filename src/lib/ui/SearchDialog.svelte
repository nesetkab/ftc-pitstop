<script lang="ts">
	import { goto } from '$app/navigation';
	import { clearRecent, readRecent, rememberRecent } from './recent-searches.ts';
	import { searchApi } from './search-results.ts';
	import { searchShortcut, type SearchFn, type SearchResult } from './search.svelte.ts';

	interface Props {
		open?: boolean;
		search?: SearchFn;
		onselect?: (result: SearchResult) => void;
		delay?: number;
		shortcuts?: boolean;
	}

	let {
		open = $bindable(false),
		search = searchApi,
		onselect,
		delay = 120,
		shortcuts = true
	}: Props = $props();

	const id = $props.id();
	const listId = `${id}-list`;
	const optionId = (index: number) => `${id}-option-${index}`;

	let dialog = $state<HTMLDialogElement>();
	let input = $state<HTMLInputElement>();
	let query = $state('');
	let results = $state<SearchResult[]>([]);
	let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	let active = $state(-1);
	let recent = $state<SearchResult[]>([]);
	let opener: HTMLElement | null = null;
	let restoreFocus = true;

	function typeOrder(list: SearchResult[]): SearchResult['type'][] {
		const first = list[0]?.type ?? 'team';
		return first === 'team' ? ['team', 'event'] : ['event', 'team'];
	}

	const showingRecent = $derived(!query.trim() && recent.length > 0);

	const ordered = $derived(
		showingRecent
			? recent
			: typeOrder(results).flatMap((type) => results.filter((result) => result.type === type))
	);

	const groups = $derived(
		showingRecent
			? [
					{
						type: 'recent',
						label: 'Recent',
						items: ordered.map((result, index) => ({ result, index }))
					}
				]
			: typeOrder(results)
					.map((type) => ({
						type,
						label: type === 'team' ? 'Teams' : 'Events',
						items: ordered.flatMap((result, index) =>
							result.type === type ? [{ result, index }] : []
						)
					}))
					.filter((group) => group.items.length > 0)
	);

	const message = $derived.by(() => {
		const trimmed = query.trim();
		if (!trimmed && showingRecent) return '';
		if (!trimmed) return 'Type a team number or name, a city or state, or an event name or code.';
		if (status === 'error') return "Search isn't working right now. Try again in a moment.";
		if (status === 'loading' && ordered.length === 0) return 'Searching…';
		if (status === 'done' && ordered.length === 0) return `No teams or events match "${trimmed}".`;
		return '';
	});

	const summary = $derived(`${ordered.length} ${ordered.length === 1 ? 'result' : 'results'}`);

	$effect(() => {
		const trimmed = query.trim();
		const find = search;
		if (!trimmed) {
			results = [];
			status = 'idle';
			active = recent.length > 0 ? 0 : -1;
			return;
		}
		const controller = new AbortController();
		const run = async () => {
			status = 'loading';
			try {
				const found = await find(trimmed, controller.signal);
				if (controller.signal.aborted) return;
				results = found;
				active = found.length > 0 ? 0 : -1;
				status = 'done';
			} catch {
				if (controller.signal.aborted) return;
				results = [];
				active = -1;
				status = 'error';
			}
		};
		const timer = setTimeout(run, delay);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	$effect(() => {
		if (!dialog || !input) return;
		if (open && !dialog.open) {
			opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			recent = readRecent();
			if (!query.trim()) active = recent.length > 0 ? 0 : -1;
			dialog.showModal();
			input.focus();
			input.select();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	$effect(() => {
		const element = dialog;
		if (!element) return;
		const dismiss = (event: MouseEvent) => {
			if (event.target === element) open = false;
		};
		element.addEventListener('click', dismiss);
		return () => element.removeEventListener('click', dismiss);
	});

	$effect(() => {
		if (active < 0) return;
		document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
	});

	function onWindowKeydown(event: KeyboardEvent) {
		if (!shortcuts) return;
		const shortcut = searchShortcut(event);
		if (!shortcut || (shortcut === 'slash' && open)) return;
		event.preventDefault();
		if (open) input?.select();
		else open = true;
	}

	function move(step: number) {
		if (ordered.length === 0) return;
		active = (active + step + ordered.length) % ordered.length;
	}

	function onInputKeydown(event: KeyboardEvent) {
		if (event.isComposing) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			move(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			move(-1);
		} else if (event.key === 'Enter') {
			const number = query.trim();
			if (active < 0 && /^\d{1,6}$/.test(number)) {
				event.preventDefault();
				restoreFocus = false;
				open = false;
				goto(`/teams/${number}`);
				return;
			}
			if (active < 0) return;
			event.preventDefault();
			document.getElementById(optionId(active))?.click();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			open = false;
		}
	}

	function pick(event: MouseEvent, result: SearchResult) {
		recent = rememberRecent(result);
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		restoreFocus = false;
		open = false;
		if (onselect) {
			event.preventDefault();
			onselect(result);
		}
	}

	function forget() {
		recent = clearRecent();
		active = -1;
		input?.focus();
	}

	function onClose() {
		open = false;
		if (restoreFocus) opener?.focus();
		opener = null;
		restoreFocus = true;
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<dialog bind:this={dialog} class="search" aria-labelledby="{id}-title" onclose={onClose}>
	<div class="box">
		<div class="field">
			<label id="{id}-title" for="{id}-input" class="visually-hidden">Search teams and events</label
			>
			<input
				bind:this={input}
				bind:value={query}
				id="{id}-input"
				type="text"
				role="combobox"
				aria-expanded={ordered.length > 0}
				aria-controls={listId}
				aria-autocomplete="list"
				aria-activedescendant={active >= 0 ? optionId(active) : undefined}
				placeholder="Search teams and events"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				enterkeyhint="go"
				onkeydown={onInputKeydown}
			/>
			<kbd aria-hidden="true">Esc</kbd>
		</div>

		<div class="list" hidden={ordered.length === 0}>
			{#if showingRecent}
				<div class="group-label">
					<span aria-hidden="true">Recent</span>
					<button type="button" class="clear" onclick={forget}>Clear</button>
				</div>
			{/if}
			<div id={listId} role="listbox" aria-label="Results">
				{#each groups as group (group.type)}
					<div role="group" aria-label={group.label}>
						{#if group.type !== 'recent'}
							<div class="group-label" aria-hidden="true">{group.label}</div>
						{/if}
						{#each group.items as { result, index } (index)}
							<a
								id={optionId(index)}
								class="option"
								href={result.href}
								role="option"
								tabindex="-1"
								aria-selected={index === active}
								onclick={(event) => pick(event, result)}
								onpointermove={() => (active = index)}
							>
								<span class="label">{result.label}</span>
								{#if result.meta}
									<span class={['meta', { live: result.live }]}>
										{#if result.live}<span class="dot" aria-hidden="true"></span>{/if}{result.meta}
									</span>
								{/if}
								{#if result.sublabel}
									<span class="sublabel">{result.sublabel}</span>
								{/if}
							</a>
						{/each}
					</div>
				{/each}
			</div>
		</div>

		<p class={['message', { 'visually-hidden': !message }]} role="status">
			{message || summary}
		</p>

		<div class="hints" aria-hidden="true">
			<span><kbd>↑</kbd> <kbd>↓</kbd> to move</span>
			<span><kbd>Enter</kbd> to open</span>
			<span><kbd>Esc</kbd> to close</span>
		</div>
	</div>
</dialog>

<style>
	.search {
		width: min(640px, calc(100vw - 32px));
		max-width: none;
		max-height: min(560px, calc(100dvh - 32px));
		margin: min(12vh, 96px) auto auto;
		padding: 0;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-panel);
		background: var(--bg);
		color: var(--text);
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
		overflow: hidden;
	}

	.search::backdrop {
		background: rgba(0, 0, 0, 0.36);
	}

	.box {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto auto;
		max-height: inherit;
	}

	.field {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 4px 14px;
		border-bottom: 1px solid var(--line);
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 10px 0;
		border: 0;
		background: transparent;
		font-size: 16px;
		outline: none;
	}

	input::placeholder {
		color: var(--text-3);
	}

	.field:focus-within {
		border-bottom-color: var(--line-2);
	}

	.list {
		overflow-y: auto;
		padding: 4px 6px 8px;
		overscroll-behavior: contain;
	}

	.group-label {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 10px 10px 4px;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--text-3);
	}

	.clear {
		min-height: 24px;
		margin: -4px -6px -4px 0;
		padding: 0 6px;
		border: 0;
		background: none;
		font: inherit;
		color: var(--text-2);
		cursor: pointer;
	}

	.clear:hover {
		color: var(--text);
		text-decoration: underline;
	}

	.option {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		column-gap: 16px;
		row-gap: 1px;
		align-items: baseline;
		padding: 8px 10px;
		border-radius: var(--radius-control);
		text-decoration: none;
	}

	.option .sublabel {
		grid-column: 1 / -1;
	}

	.meta {
		font-size: 13px;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.meta.live {
		font-weight: 600;
		color: var(--text);
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 6px;
		border-radius: 50%;
		background: var(--red);
		vertical-align: 2px;
	}

	.option[aria-selected='true'] {
		background: var(--surface);
	}

	.label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 15px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.sublabel {
		font-size: 13px;
		color: var(--text-2);
	}

	.message {
		padding: 14px;
		font-size: 14px;
		color: var(--text-2);
	}

	.hints {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
		padding: 9px 14px;
		border-top: 1px solid var(--line);
		font-size: 12px;
		color: var(--text-3);
	}

	@media (hover: none) {
		.hints,
		.field kbd {
			display: none;
		}
	}
</style>
