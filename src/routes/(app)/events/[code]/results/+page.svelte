<script lang="ts">
	import { getEventView } from '#lib/components/event/context.ts';
	import ResultsTable from '#lib/components/event/ResultsTable.svelte';
	import { withBreakdowns } from '#lib/game/breakdowns.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const bundle = $derived(withBreakdowns(data.bundle, data.breakdowns));
	const played = $derived(bundle.matches.some((match) => match.result !== null));
	const initialOrder = () => (data.bundle.phase === 'done' ? 'asc' : 'desc');
	let order = $state<'asc' | 'desc'>(initialOrder());
</script>

{#if played}
	<ResultsTable
		code={bundle.event.code}
		matches={bundle.matches}
		followed={view.followed}
		bind:order
	/>
{:else}
	<EmptyState title="No matches have been played yet." />
{/if}
