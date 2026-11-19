<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		sticky?: boolean;
		maxHeight?: string;
	}

	let { children, sticky = false, maxHeight = '70vh' }: Props = $props();
</script>

<div class={['table-wrap', { sticky }]} style:max-height={sticky ? maxHeight : undefined}>
	<table class={['t', { sticky }]}>
		{@render children()}
	</table>
</div>

<style>
	.table-wrap {
		overflow-x: auto;
	}

	.table-wrap.sticky {
		overflow-y: auto;
	}
</style>
