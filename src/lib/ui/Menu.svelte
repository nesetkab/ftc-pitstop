<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		children: Snippet<[close: () => void]>;
	}

	let { label, children }: Props = $props();

	let menu = $state<HTMLDetailsElement>();

	function close() {
		if (menu) menu.open = false;
	}

	$effect(() => {
		const element = menu;
		if (!element) return;
		const outside = (event: Event) => {
			if (element.open && !element.contains(event.target as Node)) close();
		};
		const escape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || !element.open) return;
			close();
			element.querySelector('summary')?.focus();
		};
		document.addEventListener('click', outside);
		document.addEventListener('keydown', escape);
		return () => {
			document.removeEventListener('click', outside);
			document.removeEventListener('keydown', escape);
		};
	});
</script>

<details class="menu" bind:this={menu}>
	<summary>{label}</summary>
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
		gap: 8px;
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
		width: 5px;
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
