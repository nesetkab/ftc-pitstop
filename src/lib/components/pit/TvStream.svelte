<script lang="ts">
	import { eventStream } from '#lib/stream.ts';
	import type { Event } from '#lib/types.ts';
	import MatchList from '#lib/ui/MatchList.svelte';
	import Facts from './Facts.svelte';
	import NextHero from './NextHero.svelte';
	import RankTable from './RankTable.svelte';
	import StreamPlayer from './StreamPlayer.svelte';
	import { eventFacts, matchItems } from './copy.ts';
	import type { QueueCall } from './queue.ts';
	import type { PitView } from './view.ts';

	interface Props {
		view: PitView;
		event: Event;
		call: QueueCall | null;
		now: number;
	}

	let { view, event, call, now }: Props = $props();

	const timeZone = $derived(event.timezone);
	const next = $derived(view.next);
	const rankLabel = $derived(view.rankedAfter ? `Rankings after ${view.rankedAfter}` : 'Rankings');
	const playoffLabel = $derived(
		next?.level === 'playoff' && view.playoff?.position
			? `Next match · ${view.playoff.position}`
			: 'Next match'
	);
</script>

<div class="cols" style:--cols="minmax(0, 1fr) 30em">
	<section class="watch">
		<h2 class="visually-hidden">Live stream</h2>
		<StreamPlayer code={event.code} listed={eventStream(event)} />
		{#if view.matches.length > 0}
			<h2 class="tv-label">Our matches</h2>
			<MatchList items={matchItems(view.matches, next?.key ?? null, timeZone, now, 3)} />
		{/if}
	</section>
	<section
		class="side"
		style:grid-template-rows={next ? 'auto auto minmax(0, 1fr)' : 'auto minmax(0, 1fr)'}
	>
		{#if next}
			<div class="next">
				<NextHero
					{next}
					{call}
					{now}
					{timeZone}
					delaySeconds={view.delaySeconds}
					showRp={false}
					label={playoffLabel}
				/>
			</div>
		{/if}
		{#if view.rankings.length > 0}
			<h2 class="tv-label">{rankLabel}</h2>
			<RankTable rankings={view.rankings} team={view.team} names={view.names} caption={rankLabel} />
		{:else}
			<h2 class="tv-label">This event</h2>
			<Facts facts={eventFacts(view)} />
		{/if}
	</section>
</div>

<style>
	.side {
		align-content: stretch;
	}

	.next {
		display: grid;
		gap: 0.9em;
	}
</style>
