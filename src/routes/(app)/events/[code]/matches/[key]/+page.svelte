<script lang="ts">
	import { getEventView } from '#lib/components/event/context.ts';
	import MatchView from '#lib/components/event/MatchView.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const match = $derived(data.bundle.matches.find((entry) => entry.key === data.key) ?? null);
</script>

<svelte:head>
	<title>{match?.label ?? 'Match'} at {data.bundle.event.name}</title>
</svelte:head>

{#if match}
	<MatchView bundle={data.bundle} {match} analysis={data.analysis} followed={view.followed} />
{:else}
	<EmptyState title="This match isn't in the schedule anymore." />
{/if}
