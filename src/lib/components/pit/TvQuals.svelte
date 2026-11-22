<script lang="ts">
	import MatchList from '#lib/ui/MatchList.svelte';
	import Facts from './Facts.svelte';
	import NextHero from './NextHero.svelte';
	import RankTable from './RankTable.svelte';
	import { eventFacts, lastResultItem, matchItems, qualsDoneText } from './copy.ts';
	import type { QueueCall } from './queue.ts';
	import { rankWindow, type PitView } from './view.ts';

	interface Props {
		view: PitView;
		call: QueueCall | null;
		now: number;
		timeZone: string;
		rankRows?: number;
	}

	let { view, call, now, timeZone, rankRows = 27 }: Props = $props();

	const rows = $derived(rankWindow(view.rankings, view.team, rankRows));
	const rankLabel = $derived(view.rankedAfter ? `Rankings after ${view.rankedAfter}` : 'Rankings');
	const done = $derived(qualsDoneText(view));
</script>

<div class="cols" style:--cols="31em 23em minmax(0, 1fr)">
	<section>
		{#if view.next}
			<NextHero next={view.next} {call} {now} {timeZone} delaySeconds={view.delaySeconds} />
		{:else}
			<span class="tv-label">Next match</span>
			<p class="done">{done.headline}</p>
			<p class="sub">{done.detail}</p>
		{/if}
	</section>
	<section>
		<span class="tv-label">{rankLabel}</span>
		{#if rows.length > 0}
			<RankTable {rows} team={view.team} names={view.names} caption={rankLabel} />
		{:else}
			<p class="sub">Rankings show up after the first match is posted.</p>
		{/if}
	</section>
	<section>
		<span class="tv-label">Our matches</span>
		{#if view.matches.length > 0}
			<MatchList items={matchItems(view.matches, view.next?.key ?? null, timeZone, now, 7)} />
		{:else}
			<p class="sub">No matches scheduled for {view.team}.</p>
		{/if}
		<span class="tv-label">This event</span>
		<Facts facts={eventFacts(view)} />
		{#if view.lastResult}
			<span class="tv-label">Last result</span>
			<MatchList items={[lastResultItem(view.lastResult)]} />
		{/if}
	</section>
</div>

<style>
	.done {
		font-size: 2.4em;
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.sub {
		font-size: 0.9em;
		color: var(--text-2);
	}
</style>
