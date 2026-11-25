<script lang="ts">
	import Lede from '#lib/ui/Lede.svelte';

	interface Props {
		lines: string[];
	}

	let { lines }: Props = $props();

	const rest = $derived(
		lines
			.slice(1)
			.map((line) => `${line}.`)
			.join(' ')
	);
</script>

{#if lines.length > 0}
	<Lede lead="{lines[0]}." {rest} aria-label="Season takeaways" />
{/if}
