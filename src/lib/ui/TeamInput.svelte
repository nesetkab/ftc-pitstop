<script lang="ts">
	import { searchApi } from '#lib/ui/search-results.ts';
	import type { SearchFn } from '#lib/ui/search.svelte.ts';
	import { isNumberEntry, needsLookup, teamLookup, type TeamHit } from '#lib/ui/team-lookup.ts';

	interface Props {
		value?: string;
		id?: string;
		name?: string;
		label?: string;
		listLabel?: string;
		placeholder?: string;
		maxlength?: number;
		class?: string;
		invalid?: boolean;
		describedby?: string;
		required?: boolean;
		enterkeyhint?: 'go' | 'done' | 'search' | 'enter';
		onpick?: (number: number, hit: TeamHit) => void;
		oninput?: (value: string) => void;
		search?: SearchFn;
		delay?: number;
	}

	let {
		value = $bindable(''),
		id,
		name,
		label,
		listLabel = 'Matching teams',
		placeholder = 'Team number or name',
		maxlength = 40,
		class: className = 'ctl-input',
		invalid = false,
		describedby,
		required,
		enterkeyhint,
		onpick,
		oninput,
		search = searchApi,
		delay = 200
	}: Props = $props();

	const own = $props.id();
	const inputId = $derived(id ?? `${own}-input`);
	const lookup = $derived(teamLookup(search));
	let typed = $state(false);
	let hits = $state<TeamHit[]>([]);
	let active = $state(-1);
	let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	const open = $derived(typed && (hits.length > 0 || status === 'done' || status === 'error'));

	$effect(() => {
		const text = value;
		const find = lookup;
		if (!typed || !needsLookup(text)) {
			hits = [];
			active = -1;
			status = 'idle';
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			status = 'loading';
			try {
				const found = await find(text, controller.signal);
				if (controller.signal.aborted) return;
				hits = found;
				active = found.length > 0 && !isNumberEntry(text) ? 0 : -1;
				status = 'done';
			} catch {
				if (controller.signal.aborted) return;
				hits = [];
				active = -1;
				status = 'error';
			}
		}, delay);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	function pick(hit: TeamHit) {
		value = String(hit.number);
		typed = false;
		onpick?.(hit.number, hit);
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			event.preventDefault();
			typed = false;
			return;
		}
		if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && open && hits.length > 0) {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			active = (active + step + hits.length) % hits.length;
			return;
		}
		if (event.key !== 'Enter' || event.isComposing) return;
		const chosen = open ? hits[active] : undefined;
		if (chosen) {
			event.preventDefault();
			pick(chosen);
		} else if (!isNumberEntry(value.trim())) {
			event.preventDefault();
		}
	}

	function input(event: Event & { currentTarget: HTMLInputElement }) {
		typed = true;
		oninput?.(event.currentTarget.value);
	}

	function change(event: Event & { currentTarget: HTMLInputElement }) {
		if (!isNumberEntry(event.currentTarget.value.trim())) event.stopPropagation();
	}

	function focusout(event: FocusEvent) {
		const next = event.relatedTarget;
		if (!(next instanceof Node) || !(event.currentTarget as HTMLElement).contains(next)) {
			typed = false;
		}
	}
</script>

<span class="team-input" onfocusout={focusout}>
	<input
		id={inputId}
		class={className}
		{name}
		type="text"
		autocomplete="off"
		autocapitalize="words"
		spellcheck="false"
		{enterkeyhint}
		{placeholder}
		{maxlength}
		{required}
		aria-label={label}
		role="combobox"
		aria-expanded={open}
		aria-controls="{inputId}-list"
		aria-autocomplete="list"
		aria-activedescendant={open && active >= 0 ? `${inputId}-hit-${active}` : undefined}
		aria-invalid={invalid ? 'true' : undefined}
		aria-describedby={describedby}
		bind:value
		oninput={input}
		onchange={change}
		onkeydown={keydown}
	/>
	<span class="pop" id="{inputId}-list" role="listbox" aria-label={listLabel} hidden={!open}>
		{#each hits as hit, index (hit.number)}
			<button
				type="button"
				role="option"
				id="{inputId}-hit-{index}"
				aria-selected={index === active}
				class:active={index === active}
				tabindex="-1"
				onpointerdown={(event) => event.preventDefault()}
				onclick={() => pick(hit)}
			>
				<b>{hit.number}</b>
				<span class="hit-name">{hit.name}</span>
				{#if hit.place}<span class="place">{hit.place}</span>{/if}
			</button>
		{:else}
			<span class="empty" role="status">
				{status === 'error'
					? "Search isn't working right now. Type a team number."
					: `No teams match "${value.trim()}".`}
			</span>
		{/each}
	</span>
</span>

<style>
	.team-input {
		position: relative;
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
	}

	.pop {
		position: absolute;
		top: calc(100% + 2px);
		right: 0;
		left: 0;
		z-index: 5;
		display: grid;
		padding: 4px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
	}

	.pop[hidden] {
		display: none;
	}

	button {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
		padding: 7px 8px;
		border: 0;
		border-radius: calc(var(--radius-control) - 2px);
		background: none;
		color: var(--text);
		font: 400 14px/1.3 var(--font);
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
	}

	button:hover,
	button.active {
		background: var(--surface);
	}

	b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.hit-name,
	.place {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.place {
		flex: 0 1 auto;
		font-size: 13px;
		color: var(--text-3);
	}

	.empty {
		padding: 7px 8px;
		font-size: 13px;
		color: var(--text-2);
	}

	@media (max-width: 480px) {
		.place {
			display: none;
		}
	}

	@media (pointer: coarse) {
		button {
			align-items: center;
			min-height: 40px;
		}
	}
</style>
