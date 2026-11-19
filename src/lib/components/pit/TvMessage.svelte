<script lang="ts">
	import Logo from '#lib/ui/Logo.svelte';

	interface Props {
		title: string;
		detail?: string;
	}

	let { title, detail }: Props = $props();
</script>

<div class="tv pit">
	<header><Logo height="0.95em" /></header>
	<div class="message" role="status">
		<p class="title">{title}</p>
		{#if detail}<p class="detail">{detail}</p>{/if}
	</div>
</div>

<style>
	.tv {
		position: fixed;
		inset: 0;
		display: grid;
		grid-template-rows: 2.6em minmax(0, 1fr);
		background: var(--bg);
		color: var(--text);
		font-size: max(12px, min(1.25vw, 2.2222vh));
		line-height: 1.25;
	}

	header {
		display: flex;
		align-items: center;
		padding: 0 1.4em;
		border-bottom: 1px solid var(--line);
		font-size: 0.9em;
	}

	.message {
		display: grid;
		align-content: center;
		gap: 0.6em;
		padding: 0 3em;
	}

	.title {
		margin: 0;
		font-size: 2.4em;
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.detail {
		margin: 0;
		color: var(--text-2);
	}
</style>
