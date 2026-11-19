<script lang="ts">
	import AwardsList from '#lib/components/event/AwardsList.svelte';
	import { groupAwards } from '#lib/components/event/awards.ts';
	import { getEventView } from '#lib/components/event/context.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const bundle = $derived(data.bundle);
	const given = $derived(groupAwards(bundle.awards).length > 0);
</script>

<svelte:head>
	<title>Awards at {bundle.event.name}</title>
</svelte:head>

{#if given}
	<AwardsList awards={bundle.awards} teams={bundle.teams} followed={view.followed} />
{:else}
	<EmptyState title="No awards yet.">Awards show here once they're announced.</EmptyState>
{/if}
