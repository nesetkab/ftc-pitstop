<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		meta?: string;
		status?: Snippet;
		actions?: Snippet;
	}

	let { title, meta, status, actions }: Props = $props();
</script>

<header class="page-header">
	<div class="text">
		<h1>{title}</h1>
		{#if meta}
			<p class="meta">{meta}</p>
		{/if}
		{#if status}
			<p class="status">{@render status()}</p>
		{/if}
	</div>
	{#if actions}
		<div class="actions">{@render actions()}</div>
	{/if}
</header>

<style>
	.page-header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 12px 20px;
		align-items: end;
	}

	.text {
		display: grid;
		gap: 6px;
		min-width: 0;
	}

	h1 {
		font-size: 26px;
		line-height: 1.2;
		letter-spacing: -0.015em;
		text-wrap: pretty;
	}

	.meta {
		font-size: 15px;
		color: var(--text-2);
	}

	.status {
		font-size: 14px;
		color: var(--text-2);
	}

	.status :global(b),
	.status :global(strong) {
		color: var(--text);
		font-weight: 500;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	@media (max-width: 760px) {
		.page-header {
			grid-template-columns: minmax(0, 1fr);
			align-items: start;
		}
	}

	@media (max-width: 600px) {
		.actions:has(> :global(:nth-child(3))) {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
