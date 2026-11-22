<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getEventView } from '#lib/components/event/context.ts';
	import {
		hasChoice,
		parseRankingChoice,
		rankingQuery,
		type RankingChoice
	} from '#lib/components/event/ranking-columns.ts';
	import { loadRankingChoice, saveRankingChoice } from '#lib/components/event/ranking-store.ts';
	import RankingsView from '#lib/components/event/RankingsView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const choice = $derived(parseRankingChoice(page.url.searchParams));

	function show(next: RankingChoice) {
		const query = rankingQuery(next);
		goto(query || page.url.pathname, { replace: true, reset: false });
	}

	function choose(next: RankingChoice) {
		saveRankingChoice(next);
		show(next);
	}

	onMount(() => {
		if (hasChoice(page.url.searchParams)) return;
		const saved = loadRankingChoice();
		if (saved && rankingQuery(saved)) show(saved);
	});
</script>

<RankingsView
	bundle={data.bundle}
	analysis={data.analysis}
	rp={data.rp}
	followed={view.followed}
	csvHref="/events/{data.bundle.event.code}/rankings.csv"
	{choice}
	onchoose={choose}
	eventCode={data.bundle.event.code}
/>
