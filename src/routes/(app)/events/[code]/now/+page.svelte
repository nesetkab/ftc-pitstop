<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { getEventView } from '#lib/components/event/context.ts';
	import LiveNow from '#lib/components/event/LiveNow.svelte';
	import { replaySettings } from '#lib/game/replay.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const bundle = $derived(data.bundle);
	const replay = $derived(replaySettings(new URLSearchParams(page.url.search), bundle));
</script>

{#if bundle.matches.length === 0}
	<EmptyState title="The match schedule hasn't been posted yet.">
		This page fills in on its own once it is.
	</EmptyState>
{:else}
	{#key `${bundle.event.code}:${page.url.search}`}
		<LiveNow
			{bundle}
			analysis={data.analysis}
			{replay}
			followed={view.followed}
			reload={() => invalidate('event:live')}
		/>
	{/key}
{/if}
