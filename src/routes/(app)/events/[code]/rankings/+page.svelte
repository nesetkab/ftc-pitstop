<script lang="ts">
	import RankingsPage from '#lib/components/event/RankingsPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<RankingsPage bundle={data.bundle} analysis={data.analysis} rp={data.rp} />
