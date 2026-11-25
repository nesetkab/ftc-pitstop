<script lang="ts">
	import { eventStream } from '#lib/stream.ts';
	import type { Event } from '#lib/types.ts';
	import MatchList from '#lib/ui/MatchList.svelte';
	import Facts from './Facts.svelte';
	import NextHero from './NextHero.svelte';
	import RankTable from './RankTable.svelte';
	import StreamPlayer from './StreamPlayer.svelte';
	import { eventFacts, matchItems, nextMatchLabel } from './copy.ts';
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
		nextMatchLabel(next?.level === 'playoff' ? (view.playoff?.position ?? null) : null)
	);
</script>

<div class="cols" style:--cols="minmax(0, 1fr) 30em">
	<section class="watch">
		<h2 class="visually-hidden">Live stream</h2>
		<div class="fit">
			<StreamPlayer code={event.code} listed={eventStream(event)} />
		</div>
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
	.watch {
		grid-template-rows: minmax(0, 1fr) auto auto;
		align-content: stretch;
	}

	.fit {
		min-height: 0;
		container-type: size;
	}

	.fit :global(.frame) {
		width: min(100%, calc((100cqh - 3.2em) * 16 / 9));
	}

	.side {
		align-content: stretch;
	}

	.next {
		display: grid;
		gap: 0.9em;
	}
</style>
