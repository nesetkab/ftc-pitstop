<script lang="ts">
	import { goto } from '$app/navigation';
	import { highlight } from './highlight.ts';
	import Icon from './Icon.svelte';
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
		if (!trimmed) return '';
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
			<Icon name="search" />
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
			<button type="button" class="close" aria-label="Close search" onclick={() => (open = false)}>
				<Icon name="close" />
			</button>
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
					<div role="group" aria-label={group.label} class="group">
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
								<span class="kind"><Icon name={result.type} /></span>
								<span class="label"
									>{#each highlight(result.label, query) as part, i (i)}{#if part.hit}<mark
												>{part.text}</mark
											>{:else}{part.text}{/if}{/each}</span
								>
								{#if result.aside ?? result.meta}
									<span class={['aside', { live: result.live }]}>
										{#if result.live}<span class="dot" aria-hidden="true"
											></span>{/if}{result.aside ?? result.meta}
									</span>
								{/if}
							</a>
						{/each}
					</div>
				{/each}
			</div>
		</div>

		{#if !query.trim() && !showingRecent}
			<ul class="tips" aria-label="What you can search">
				<li><Icon name="team" /> Team number or name</li>
				<li><Icon name="event" /> Event name or code</li>
				<li><Icon name="search" /> City, state or country</li>
			</ul>
		{/if}

		<p class={['message', { 'visually-hidden': !message }]} role="status">
			{message || (ordered.length > 0 || query.trim() ? summary : '')}
		</p>
	</div>
</dialog>

<style>
	.search {
		width: min(560px, calc(100vw - 2 * var(--gutter)));
		max-width: none;
		max-height: min(520px, calc(100dvh - 16px));
		margin: 8px max(var(--gutter), calc((100vw - var(--page-max)) / 2 + var(--gutter))) auto auto;
		padding: 0;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-panel);
		background: var(--bg);
		color: var(--text);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
		overflow: hidden;
	}

	.search::backdrop {
		background: rgba(0, 0, 0, 0.12);
	}

	.box {
		display: flex;
		flex-direction: column;
		max-height: inherit;
	}

	.field {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 6px 4px 14px;
		border-bottom: 1px solid var(--line);
		color: var(--text-3);
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 11px 0;
		border: 0;
		background: transparent;
		color: var(--text);
		font-size: 16px;
		outline: none;
	}

	input::placeholder {
		color: var(--text-3);
	}

	.close {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: var(--radius-control);
		background: none;
		color: var(--text-3);
		cursor: pointer;
	}

	.close:hover {
		color: var(--text);
		background: var(--surface);
	}

	.list {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 6px;
		overscroll-behavior: contain;
	}

	.group + .group {
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px solid var(--line);
	}

	.group-label {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 6px 10px 4px;
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
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 38px;
		padding: 6px 10px;
		border-radius: var(--radius-control);
		text-decoration: none;
	}

	.option[aria-selected='true'] {
		background: var(--surface);
	}

	.kind {
		color: var(--text-3);
	}

	.option[aria-selected='true'] .kind {
		color: var(--text);
	}

	.label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 15px;
		font-variant-numeric: tabular-nums;
	}

	mark {
		background: none;
		color: inherit;
		font-weight: 600;
	}

	.aside {
		flex: none;
		max-width: 45%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 13px;
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.aside.live {
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

	.tips {
		display: grid;
		gap: 2px;
		margin: 0;
		padding: 10px 6px;
		list-style: none;
	}

	.tips li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 7px 10px;
		font-size: 14px;
		color: var(--text-2);
	}

	.tips :global(.icon) {
		color: var(--text-3);
	}

	.message {
		padding: 14px;
		font-size: 14px;
		color: var(--text-2);
	}

	@media (max-width: 900px) {
		.search {
			width: calc(100vw - 2 * var(--gutter));
			margin-inline: auto;
		}
	}

	@media (max-width: 600px) {
		.aside {
			max-width: 38%;
		}
	}
</style>
