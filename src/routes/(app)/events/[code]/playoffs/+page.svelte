<script lang="ts">
	import { getEventView } from '#lib/components/event/context.ts';
	import { teamsAction } from '#lib/components/event/empty.ts';
	import PlayoffsView from '#lib/components/event/PlayoffsView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
</script>

<PlayoffsView
	bundle={data.bundle}
	odds={data.analysis?.playoffs ?? null}
	followed={view.followed}
	teams={teamsAction(data.bundle)}
/>
