<script lang="ts">
	import type ColumnPanelComponent from './ColumnPanel.svelte';
	import { RANKING_COLUMNS, type ColumnSource, type RankingChoice } from './ranking-columns.ts';

	interface Props {
		choice: RankingChoice;
		sources: ReadonlySet<ColumnSource>;
		onchoose: (choice: RankingChoice) => void;
	}

	let { choice, sources, onchoose }: Props = $props();

	let open = $state(false);
	let root = $state<HTMLElement>();
	let trigger = $state<HTMLButtonElement>();
	let ColumnPanel = $state<typeof ColumnPanelComponent>();
	let loading: Promise<void> | undefined;
	const id = $props.id();

	const shown = $derived(
		choice.columns.filter((key) =>
			sources.has(RANKING_COLUMNS.find((column) => column.key === key)?.source ?? 'ranking')
		).length
	);

	function load() {
		loading ??= import('./ColumnPanel.svelte').then((module) => {
			ColumnPanel = module.default;
		});
		return loading;
	}

	async function toggle() {
		if (open) {
			open = false;
			return;
		}
		await load();
		open = true;
	}

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
</script>

<svelte:window {onpointerdown} />

<div class="menu" bind:this={root} {onkeydown} {onfocusout} role="presentation">
	<button
		bind:this={trigger}
		class="trigger"
		type="button"
		aria-expanded={open}
		aria-controls={id}
		onclick={toggle}
		onfocus={load}
		onpointerenter={load}
	>
		Columns <span class="count">{shown}</span>
		<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
			<path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
		</svg>
	</button>
	<div class="panel" {id} hidden={!open} role="group" aria-label="Choose columns">
		{#if ColumnPanel}
			<ColumnPanel {choice} {sources} {onchoose} ondone={() => close(true)} />
		{/if}
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

	@media (pointer: coarse) {
		.trigger {
			min-height: 40px;
		}
	}
</style>
