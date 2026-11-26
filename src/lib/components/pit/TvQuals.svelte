<script lang="ts">
	import type { Event } from '#lib/types.ts';
	import MatchList from '#lib/ui/MatchList.svelte';
	import Facts from './Facts.svelte';
	import NextHero from './NextHero.svelte';
	import RankTable from './RankTable.svelte';
	import Board from './Board.svelte';
	import StreamBox from './StreamBox.svelte';
	import ResultsPanel from './ResultsPanel.svelte';
	import { eventFacts, matchItems, qualsDoneText } from './copy.ts';
	import { useOpenMatch } from './open-match.ts';
	import { pickable } from './pickable.ts';
	import type { QueueCall } from './queue.ts';
	import type { PitView } from './view.ts';

	interface Props {
		view: PitView;
		call: QueueCall | null;
		now: number;
		timeZone: string;
		/** Set while the stream is showing. */
		streamEvent?: Event | null;
	}

	let { view, call, now, timeZone, streamEvent = null }: Props = $props();

	const rankLabel = $derived(view.rankedAfter ? `Rankings after ${view.rankedAfter}` : 'Rankings');
	const done = $derived(qualsDoneText(view));
	const open = useOpenMatch();
</script>

{#snippet next()}
	{#if view.next}
		<NextHero next={view.next} {call} {now} {timeZone} delaySeconds={view.delaySeconds} />
	{:else}
		<h2 class="tv-label">Next match</h2>
		<p class="done">{done.headline}</p>
		<p class="sub">{done.detail}</p>
	{/if}
{/snippet}

{#snippet standings()}
	<h2 class="tv-label">{rankLabel}</h2>
	{#if view.rankings.length > 0}
		<RankTable rankings={view.rankings} team={view.team} names={view.names} caption={rankLabel} />
	{:else}
		<p class="sub">Rankings show up after the first match is posted.</p>
	{/if}
{/snippet}

{#snippet matches()}
	<h2 class="tv-label">Our matches</h2>
	{#if view.matches.length > 0}
		<MatchList
			items={pickable(
				matchItems(view.matches, view.next?.key ?? null, timeZone, now),
				view.matches,
				open
			)}
		/>
	{:else}
		<p class="sub">No matches scheduled for {view.team}.</p>
	{/if}
	<h2 class="tv-label">This event</h2>
	<Facts facts={eventFacts(view)} />
{/snippet}

{#snippet results()}
	<ResultsPanel results={view.results} team={view.team} />
{/snippet}

{#snippet video()}
	{#if streamEvent}
		<StreamBox event={streamEvent} />
	{/if}
{/snippet}

<Board
	name={streamEvent ? 'stream' : 'quals'}
	areas={streamEvent
		? "'stream next results' 'standings matches results'"
		: "'next standings matches' 'next standings results'"}
	columns={streamEvent
		? 'minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr)'
		: '31em 23em minmax(0, 1fr)'}
	rows={streamEvent ? 'minmax(0, 48fr) minmax(0, 52fr)' : 'minmax(0, 1fr) minmax(0, 1fr)'}
	boxes={[
		...(streamEvent ? [{ id: 'stream' as const, label: 'stream', content: video }] : []),
		{ id: 'next', label: 'next match', content: next },
		{ id: 'standings', label: 'rankings', content: standings, fill: true },
		{ id: 'matches', label: 'our matches', content: matches },
		{ id: 'results', label: 'results', content: results, fill: true }
	]}
/>

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
