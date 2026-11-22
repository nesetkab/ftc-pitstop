<script lang="ts">
	import { getEventView } from '#lib/components/event/context.ts';
	import EventPreview from '#lib/components/event/EventPreview.svelte';
	import RankingsView from '#lib/components/event/RankingsView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const bundle = $derived(data.bundle);
	const started = $derived(
		bundle.rankings.length > 0 || bundle.matches.some((match) => match.result !== null)
	);
</script>

{#if started}
	<RankingsView
		{bundle}
		analysis={data.analysis}
		rp={data.rp}
		followed={view.followed}
		csvHref="/events/{bundle.event.code}/rankings.csv"
		eventCode={bundle.event.code}
	/>
{:else}
	<EventPreview
		code={bundle.event.code}
		teams={bundle.teams}
		matches={bundle.matches}
		timezone={bundle.event.timezone}
		ratings={data.analysis?.ratings ?? null}
		projections={data.analysis?.projections ?? null}
		followed={view.followed}
	/>
{/if}
