<script lang="ts">
	import { getEventView } from '#lib/components/event/context.ts';
	import RankingsView from '#lib/components/event/RankingsView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
</script>

<RankingsView
	bundle={data.bundle}
	analysis={data.analysis}
	followed={view.followed}
	csvHref="/events/{data.bundle.event.code}/rankings.csv"
/>
