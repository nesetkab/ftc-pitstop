<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';

	interface Props {
		label: string;
		icon?: IconName;
		children: Snippet<[close: () => void]>;
	}

	let { label, icon, children }: Props = $props();

	let menu = $state<HTMLDetailsElement>();
	let summary = $state<HTMLElement>();

	function close() {
		if (!menu?.open) return;
		const inside = menu.contains(document.activeElement);
		menu.open = false;
		if (inside) summary?.focus();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !menu?.open) return;
		event.preventDefault();
		close();
	}

	function onfocusout(event: FocusEvent) {
		const next = event.relatedTarget as Node | null;
		if (menu && next && !menu.contains(next)) menu.open = false;
	}

	function onclick(event: MouseEvent) {
		if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
	}

	$effect(() => {
		const element = menu;
		if (!element) return;
		element.addEventListener('keydown', onkeydown);
		element.addEventListener('focusout', onfocusout);
		return () => {
			element.removeEventListener('keydown', onkeydown);
			element.removeEventListener('focusout', onfocusout);
		};
	});
</script>

<svelte:document {onclick} />

<details class="menu" bind:this={menu}>
	<summary bind:this={summary}>
		{#if icon}<Icon name={icon} size={14} />{/if}{label}
	</summary>
	<div class="panel">{@render children(close)}</div>
</details>

<style>
	.menu {
		position: relative;
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: var(--control-h);
		padding: 8px 12px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		color: var(--text);
		font: 500 13px/1 var(--font);
		white-space: nowrap;
		list-style: none;
		cursor: pointer;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary::after {
		content: '';
		flex: none;
		width: 5px;
		margin-left: 2px;
		height: 5px;
		margin-top: -3px;
		border-right: 1.5px solid var(--text-2);
		border-bottom: 1.5px solid var(--text-2);
		transform: rotate(45deg);
	}

	summary:hover,
	.menu[open] summary {
		background: var(--surface);
	}

	.panel {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 20;
		width: 290px;
		padding: 6px 0;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-panel);
		background: var(--bg);
		box-shadow: var(--shadow-pop);
	}

	@media (max-width: 760px) {
		.panel {
			position: fixed;
			top: auto;
			right: 16px;
			left: 16px;
			width: auto;
			margin-top: 6px;
		}
	}

	@media (pointer: coarse) {
		summary {
			min-height: 40px;
		}
	}
</style>
