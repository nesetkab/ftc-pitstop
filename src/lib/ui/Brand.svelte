<script lang="ts">
	interface Props {
		text: string | null | undefined;
	}

	let { text }: Props = $props();

	const parts = $derived(text ? text.split(/\b(FIRST)\b/) : []);
</script>

{#each parts as part, index (index)}{#if index % 2}<em>{part}</em>{:else}{part}{/if}{/each}
