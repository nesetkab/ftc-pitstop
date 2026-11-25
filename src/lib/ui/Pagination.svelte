<script lang="ts">
	import { integer } from '#lib/format/index.ts';
	import Button from '#lib/ui/Button.svelte';

	interface Props {
		page: number;
		pages: number;
		href: (page: number) => string;
	}

	let { page, pages, href }: Props = $props();
</script>

{#if pages > 1}
	<nav class="pager" aria-label="Pages">
		{#if page > 1}
			<Button variant="secondary" icon="prev" href={href(page - 1)} rel="prev">Previous</Button>
		{:else}
			<Button variant="secondary" icon="prev" disabled>Previous</Button>
		{/if}
		<span class="n">Page {integer(page)} of {integer(pages)}</span>
		{#if page < pages}
			<Button variant="secondary" iconEnd="next" href={href(page + 1)} rel="next">Next</Button>
		{:else}
			<Button variant="secondary" iconEnd="next" disabled>Next</Button>
		{/if}
	</nav>
{/if}

<style>
	.pager {
		display: flex;
		align-items: center;
		gap: 14px;
		font-size: 14px;
		color: var(--text-2);
	}
</style>
