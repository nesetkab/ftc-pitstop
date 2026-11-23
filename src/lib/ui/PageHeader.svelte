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
	<h1>{title}</h1>
	{#if meta}
		<p class="meta">{meta}</p>
	{/if}
	{#if status}
		<p class="status">{@render status()}</p>
	{/if}
	{#if actions}
		<div class="actions">{@render actions()}</div>
	{/if}
</header>

<style>
	.page-header {
		--title-h: calc(26px * 1.2);
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 6px 20px;
	}

	.page-header > * {
		grid-column: 1;
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

	.page-header > .actions {
		grid-row: 1;
		grid-column: 2;
		align-self: start;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
		margin-top: calc((var(--title-h) - var(--control-h)) / 2);
	}

	@media (max-width: 760px) {
		.page-header {
			grid-template-columns: minmax(0, 1fr);
		}

		.page-header > .actions {
			grid-row: auto;
			grid-column: 1;
			justify-content: flex-start;
			margin-top: 6px;
		}
	}

	@media (max-width: 600px) {
		.page-header > .actions:has(> :global(:nth-child(3))) {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
