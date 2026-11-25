<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, rise } from '#lib/ui/motion.ts';

	interface Props {
		key: string;
		children: Snippet;
	}

	let { key, children }: Props = $props();
</script>

<div class="stage">
	{#key key}
		<div class="card" in:rise={{ y: 10, duration: 280, delay: 120 }} out:fade={{ duration: 120 }}>
			{@render children()}
		</div>
	{/key}
</div>

<style>
	.stage {
		display: grid;
		gap: inherit;
		min-width: 0;
		min-height: 0;
	}

	.card {
		display: grid;
		grid-area: 1 / 1;
		align-content: start;
		gap: inherit;
		min-width: 0;
	}
</style>
