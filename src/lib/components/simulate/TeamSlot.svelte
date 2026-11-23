<script lang="ts">
	import { teamHits, type TeamHit } from '#lib/components/home/finder.ts';
	import { searchApi } from '#lib/ui/search-results.ts';
	import type { SearchFn } from '#lib/ui/search.svelte.ts';
	import type { Color } from './simulate.ts';

	interface Props {
		field: string;
		label: string;
		color: Color;
		team: { number: number; name: string | null } | null;
		removeHref: string | null;
		onpick: (number: number) => void;
		search?: SearchFn;
		delay?: number;
	}

	let {
		field,
		label,
		color,
		team,
		removeHref,
		onpick,
		search = searchApi,
		delay = 200
	}: Props = $props();

	const id = $props.id();
	let query = $derived(team ? String(team.number) : '');
	let typed = $state(false);
	let hits = $state<TeamHit[]>([]);
	let active = $state(-1);
	let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	const open = $derived(typed && (hits.length > 0 || status === 'done' || status === 'error'));

	$effect(() => {
		const trimmed = query.trim();
		const find = search;
		if (!typed || !trimmed) {
			hits = [];
			status = 'idle';
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			status = 'loading';
			try {
				const found = await find(trimmed, controller.signal);
				if (controller.signal.aborted) return;
				hits = teamHits(found);
				active = -1;
				status = 'done';
			} catch {
				if (controller.signal.aborted) return;
				hits = [];
				status = 'error';
			}
		}, delay);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	function pick(hit: TeamHit) {
		query = String(hit.number);
		typed = false;
		onpick(hit.number);
	}

	function close() {
		typed = false;
	}

	function keydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			active = (active + step + hits.length) % hits.length;
		} else if (event.key === 'Escape') {
			event.preventDefault();
			close();
		} else if (event.key === 'Enter' && hits.length > 0) {
			const chosen = hits[active] ?? (/^\d+$/.test(query.trim()) ? null : hits[0]);
			if (!chosen) return;
			event.preventDefault();
			pick(chosen);
		}
	}

	function focusout(event: FocusEvent) {
		const next = event.relatedTarget;
		if (!(next instanceof Node) || !(event.currentTarget as HTMLElement).contains(next)) close();
	}
</script>

<div class="slot" onfocusout={focusout}>
	<label class={['label', color]} for="{id}-input">{label}</label>
	<div class="row">
		<input
			id="{id}-input"
			class="ctl-input"
			name={field}
			type="text"
			autocomplete="off"
			enterkeyhint="go"
			placeholder="Team number or name"
			role="combobox"
			aria-expanded={open}
			aria-controls="{id}-list"
			aria-autocomplete="list"
			aria-activedescendant={active >= 0 ? `${id}-hit-${active}` : undefined}
			bind:value={query}
			oninput={() => (typed = true)}
			onkeydown={keydown}
		/>
		{#if removeHref && team}
			<a
				class="remove"
				href={removeHref}
				aria-label="Remove {team.number} from {label}"
				data-sveltekit-noscroll>×</a
			>
		{/if}
	</div>
	{#if team}
		<a class="name" href="/teams/{team.number}">{team.name ?? `Team ${team.number}`}</a>
	{/if}
	<div class="pop" id="{id}-list" role="listbox" aria-label="Teams matching {label}" hidden={!open}>
		{#each hits as hit, index (hit.number)}
			<button
				type="button"
				role="option"
				id="{id}-hit-{index}"
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
			<p class="empty" role="status">
				{status === 'error'
					? "Search isn't working right now. Type a team number."
					: `No teams match "${query.trim()}".`}
			</p>
		{/each}
	</div>
</div>

<style>
	.slot {
		position: relative;
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	.label {
		font-size: 12.5px;
		font-weight: 500;
	}

	.label.red {
		color: var(--red);
	}

	.label.blue {
		color: var(--blue);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.remove {
		padding: 4px 8px;
		color: var(--text-3);
		font-size: 18px;
		line-height: 1;
		text-decoration: none;
	}

	.remove:hover {
		color: var(--text);
	}

	.name {
		overflow: hidden;
		font-size: 13px;
		color: var(--text-2);
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name:hover {
		color: var(--text);
		text-decoration: underline;
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

	.pop button {
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

	.pop button:hover,
	.pop button.active {
		background: var(--surface);
	}

	.pop b {
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
		font-size: 12.5px;
		color: var(--text-3);
	}

	.empty {
		padding: 7px 8px;
		font-size: 13px;
		color: var(--text-2);
	}
</style>
