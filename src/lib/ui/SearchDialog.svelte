<script lang="ts">
	import { searchApi, type SearchFn, type SearchResult } from './search.svelte.ts';

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

	const TEXT_ENTRY =
		'textarea, select, [contenteditable]:not([contenteditable="false"]), input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="color"])';

	const id = $props.id();
	const listId = `${id}-list`;
	const optionId = (index: number) => `${id}-option-${index}`;

	let dialog = $state<HTMLDialogElement>();
	let input = $state<HTMLInputElement>();
	let query = $state('');
	let results = $state<SearchResult[]>([]);
	let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	let active = $state(-1);
	let opener: HTMLElement | null = null;
	let restoreFocus = true;

	const ordered = $derived([
		...results.filter((result) => result.type === 'team'),
		...results.filter((result) => result.type === 'event')
	]);

	const groups = $derived(
		(['team', 'event'] as const)
			.map((type) => ({
				type,
				label: type === 'team' ? 'Teams' : 'Events',
				items: ordered.flatMap((result, index) => (result.type === type ? [{ result, index }] : []))
			}))
			.filter((group) => group.items.length > 0)
	);

	const message = $derived.by(() => {
		const trimmed = query.trim();
		if (!trimmed) return 'Type a team number or name, or an event name or code.';
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
			active = -1;
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

	function isTextEntry(target: EventTarget | null) {
		return target instanceof Element && target.closest(TEXT_ENTRY) !== null;
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (!shortcuts || event.defaultPrevented || event.isComposing) return;
		const shortcut =
			(event.metaKey || event.ctrlKey) &&
			!event.altKey &&
			!event.shiftKey &&
			event.key.toLowerCase() === 'k';
		if (shortcut) {
			event.preventDefault();
			if (open) input?.select();
			else open = true;
			return;
		}
		if (
			event.key === '/' &&
			!open &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			!isTextEntry(event.target)
		) {
			event.preventDefault();
			open = true;
		}
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
			if (active < 0) return;
			event.preventDefault();
			document.getElementById(optionId(active))?.click();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			open = false;
		}
	}

	function pick(event: MouseEvent, result: SearchResult) {
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

		<div class="list" id={listId} role="listbox" aria-label="Results" hidden={ordered.length === 0}>
			{#each groups as group (group.type)}
				<div class="group-label" aria-hidden="true">{group.label}</div>
				<div role="group" aria-label={group.label}>
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
							{#if result.sublabel}
								<span class="sublabel">{result.sublabel}</span>
							{/if}
						</a>
					{/each}
				</div>
			{/each}
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
		padding: 10px 10px 4px;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--text-3);
	}

	.option {
		display: grid;
		gap: 1px;
		padding: 8px 10px;
		border-radius: var(--radius-control);
		text-decoration: none;
	}

	.option[aria-selected='true'] {
		background: var(--surface);
	}

	.label {
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
