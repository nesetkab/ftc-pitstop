<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		children?: Snippet;
	}

	let { title, children }: Props = $props();
</script>

<div class="empty">
	<p class="title">{title}</p>
	{#if children}
		<div class="body">{@render children()}</div>
	{/if}
</div>

<style>
	.empty {
		display: grid;
		gap: 4px;
		padding: 16px 18px;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--surface);
	}

	.title {
		font-weight: 600;
	}

	.body {
		font-size: 14px;
		color: var(--text-2);
	}
</style>
