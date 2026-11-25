<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		count?: number;
		panelLabel: string;
		width?: number;
		children: Snippet<[close: (focus?: boolean) => void]>;
	}

	let { label, count = 0, panelLabel, width = 420, children }: Props = $props();

	let open = $state(false);
	let root = $state<HTMLElement>();
	let trigger = $state<HTMLButtonElement>();
	const id = $props.id();

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
</script>

<svelte:window {onpointerdown} />

<div class="menu" bind:this={root} {onkeydown} role="presentation">
	<button
		bind:this={trigger}
		class={['trigger', { on: count > 0 }]}
		type="button"
		aria-expanded={open}
		aria-controls={id}
		onclick={() => (open = !open)}
	>
		{label}
		{#if count > 0}<span class="count">{count}</span>{/if}
		<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
			<path d="M3 4.5 6 7.5 9 4.5" />
		</svg>
	</button>
	<div
		class="panel"
		{id}
		hidden={!open}
		role="group"
		aria-label={panelLabel}
		style:--panel-w="{width}px"
	>
		{#if open}{@render children(close)}{/if}
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
		min-height: var(--control-h);
		padding: 0 12px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		font: 500 13px/1 var(--font);
		white-space: nowrap;
		cursor: pointer;
	}

	.trigger:hover {
		border-color: var(--text-3);
	}

	.trigger[aria-expanded='true'] {
		background: var(--surface);
	}

	.count {
		min-width: 18px;
		padding: 2px 5px;
		border-radius: 999px;
		background: var(--text);
		color: var(--bg);
		font-size: 11.5px;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	svg {
		fill: none;
		stroke: var(--text-3);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.trigger[aria-expanded='true'] svg {
		transform: rotate(180deg);
	}

	.panel {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 5;
		width: min(var(--panel-w), calc(100vw - 2 * var(--gutter)));
		padding: 16px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-panel);
		background: var(--bg);
		box-shadow: var(--shadow-pop);
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
