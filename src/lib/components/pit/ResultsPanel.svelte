<script lang="ts">
	import ResultsList from './ResultsList.svelte';
	import type { ResultRow } from './view.ts';

	interface Props {
		results: ResultRow[];
		team: number;
	}

	let { results, team }: Props = $props();

	// The data arrives newest first; the list reads from the first match down.
	const ordered = $derived([...results].reverse());
</script>

<h2 class="tv-label">Last results{results.length > 0 ? ` · ${results.length}` : ''}</h2>
{#if results.length > 0}
	<ResultsList results={ordered} {team} />
{:else}
	<p class="empty">Results show up as matches are posted.</p>
{/if}

<style>
	.empty {
		font-size: 0.9em;
		color: var(--text-2);
	}
</style>
