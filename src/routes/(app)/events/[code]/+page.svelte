<script lang="ts">
	import { getEventView } from '#lib/components/event/context.ts';
	import EventPreview from '#lib/components/event/EventPreview.svelte';
	import RankingsPage from '#lib/components/event/RankingsPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const bundle = $derived(data.bundle);
	const started = $derived(
		bundle.rankings.length > 0 || bundle.matches.some((match) => match.result !== null)
	);
</script>

{#if started}
	<RankingsPage {bundle} analysis={data.analysis} rp={data.rp} />
{:else}
	<EventPreview
		code={bundle.event.code}
		teams={bundle.teams}
		matches={bundle.matches}
		timezone={bundle.event.timezone}
		phase={bundle.phase}
		ratings={data.analysis?.ratings ?? null}
		projections={data.analysis?.projections ?? null}
		followed={view.followed}
	/>
{/if}
