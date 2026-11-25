<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		label?: string;
		children: Snippet;
	}

	let { label = 'About these numbers', children }: Props = $props();
</script>

<details class="legend">
	<summary><Icon name="info" size={14} />{label}</summary>
	<div class="note body">{@render children()}</div>
</details>

<style>
	summary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--text-3);
		font-size: 13px;
		list-style: none;
		cursor: pointer;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:hover,
	.legend[open] summary {
		color: var(--text);
	}

	.body {
		max-width: 72ch;
		margin-top: 6px;
	}

	.legend[open] .body {
		animation: ps-pop 160ms ease-out;
	}

	@media (pointer: coarse) {
		summary {
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
