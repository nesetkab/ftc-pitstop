<script lang="ts" module>
	export interface EmptyAction {
		href: string;
		label: string;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		action?: EmptyAction | null;
		children?: Snippet;
	}

	let { title, action = null, children }: Props = $props();
</script>

<div class="empty">
	<p class="title">{title}</p>
	{#if children}
		<div class="body">{@render children()}</div>
	{/if}
	{#if action}
		<a class="body" href={action.href}>{action.label}</a>
	{/if}
</div>

<style>
	.empty {
		display: grid;
		justify-items: start;
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
