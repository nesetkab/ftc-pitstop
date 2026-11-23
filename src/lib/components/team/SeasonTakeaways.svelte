<script lang="ts">
	interface Props {
		lines: string[];
	}

	let { lines }: Props = $props();
</script>

{#if lines.length > 0}
	<ul class="takeaways" aria-label="Season takeaways">
		{#each lines as line (line)}
			<li>{line}</li>
		{/each}
	</ul>
{/if}

<style>
	.takeaways {
		display: grid;
		gap: 6px;
		max-width: 760px;
		margin: 0;
		padding: 0 0 0 14px;
		border-left: 2px solid var(--text);
		list-style: none;
		font-size: 16px;
		line-height: 1.4;
	}
</style>
