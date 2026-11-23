<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { EventAnalysis } from '#lib/analysis/types.ts';
	import type { EventBundle } from '#lib/types.ts';
	import { getEventView } from './context.ts';
	import {
		hasChoice,
		parseRankingChoice,
		parseRankingView,
		rankingPageQuery,
		type RankingChoice
	} from './ranking-columns.ts';
	import { loadRankingChoice, saveRankingChoice } from './ranking-store.ts';
	import RankingsView from './RankingsView.svelte';
	import type { RpCounts } from './standings.ts';

	interface Props {
		bundle: EventBundle;
		analysis: EventAnalysis | null;
		rp: Record<number, RpCounts> | null;
	}

	let { bundle, analysis, rp }: Props = $props();

	const eventView = getEventView();
	const code = $derived(bundle.event.code);
	const choice = $derived(parseRankingChoice(page.url.searchParams));
	const view = $derived(parseRankingView(page.url.searchParams));

	function show(next: RankingChoice) {
		const query = rankingPageQuery(next, view);
		goto(query || page.url.pathname, { replace: true, reset: false });
	}

	function choose(next: RankingChoice) {
		saveRankingChoice(next);
		show(next);
	}

	onMount(() => {
		if (hasChoice(page.url.searchParams)) return;
		const saved = loadRankingChoice();
		if (saved && rankingPageQuery(saved, 'standings')) show(saved);
	});
</script>

<RankingsView
	{bundle}
	{analysis}
	{rp}
	followed={eventView.followed}
	csvHref="/events/{code}/rankings.csv"
	{choice}
	{view}
	path={page.url.pathname}
	onchoose={choose}
	eventCode={code}
/>
