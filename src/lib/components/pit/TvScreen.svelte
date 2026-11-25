<script lang="ts">
	import { onMount } from 'svelte';
	import type { DataSource, Event } from '#lib/types.ts';
	import { fade } from '#lib/ui/motion.ts';
	import Takeover from './Takeover.svelte';
	import TvDone from './TvDone.svelte';
	import TvFooter from './TvFooter.svelte';
	import TvHeader from './TvHeader.svelte';
	import TvPlayoffs from './TvPlayoffs.svelte';
	import TvQuals from './TvQuals.svelte';
	import TvSelection from './TvSelection.svelte';
	import TvStream from './TvStream.svelte';
	import TvUpcoming from './TvUpcoming.svelte';
	import { absentText, heroText } from './copy.ts';
	import type { Connection } from './poll.ts';
	import type { QueueCall } from './queue.ts';
	import { readTvStream, saveTvStream } from './stream.ts';
	import type { PitView } from './view.ts';

	interface Props {
		view: PitView;
		event: Event;
		now: number;
		call: QueueCall | null;
		takeover: QueueCall | null;
		connection: Connection;
		updated: number | null;
		source: DataSource;
		stale: boolean;
		phoneUrl: string;
		replaySpeed?: number | null;
		ondismiss?: () => void;
	}

	let {
		view,
		event,
		now,
		call,
		takeover,
		connection,
		updated,
		source,
		stale,
		phoneUrl,
		replaySpeed = null,
		ondismiss = () => {}
	}: Props = $props();

	let streaming = $state(false);

	const timeZone = $derived(event.timezone);
	const absent = $derived(absentText(view));
	const screen = $derived(!view.registered ? 'absent' : streaming ? 'stream' : view.phase);
	const headline = $derived(
		takeover && view.next
			? heroText(view.next, takeover, now, timeZone, view.delaySeconds).headline
			: 'Queue now'
	);

	onMount(() => {
		streaming = readTvStream();
	});

	function toggleStream() {
		streaming = !streaming;
		saveTvStream(streaming);
	}
</script>

<div class="tv pit" data-phase={view.phase}>
	<TvHeader
		eventName={event.name}
		team={view.team}
		teamName={view.teamName}
		{now}
		{timeZone}
		streaming={view.registered ? streaming : null}
		onstream={toggleStream}
	/>
	<main class="main">
		{#key screen}
			<div class="screen" in:fade={{ duration: 400 }}>
				{#if !view.registered}
					<div class="message">
						<p class="title">{absent.title}</p>
						<p class="sub">{absent.detail}</p>
					</div>
				{:else if streaming}
					<TvStream {view} {event} {call} {now} />
				{:else if view.phase === 'upcoming'}
					<TvUpcoming {view} {event} {now} {phoneUrl} />
				{:else if view.phase === 'quals'}
					<TvQuals {view} {call} {now} {timeZone} />
				{:else if view.phase === 'selection'}
					<TvSelection {view} />
				{:else if view.phase === 'playoffs'}
					<TvPlayoffs {view} {call} {now} {timeZone} />
				{:else}
					<TvDone {view} />
				{/if}
			</div>
		{/key}
	</main>
	<TvFooter
		{connection}
		{updated}
		{source}
		{stale}
		{now}
		{timeZone}
		onField={view.onField}
		upNext={view.upNext}
		{replaySpeed}
	/>
	{#if takeover}
		<Takeover {headline} label={takeover.label} alliance={takeover.alliance} {ondismiss} />
	{/if}
</div>

<style>
	.tv {
		position: fixed;
		inset: 0;
		display: grid;
		grid-template-rows: 2.6em minmax(0, 1fr) 2.1em;
		overflow: hidden;
		background: var(--bg);
		color: var(--text);
		font-size: min(1.25vw, 2.2222vh);
		line-height: 1.25;
		font-variant-numeric: tabular-nums;
		animation: drift 2400s step-end infinite;
	}

	@keyframes drift {
		0% {
			translate: 0 0;
		}
		25% {
			translate: 2px 1px;
		}
		50% {
			translate: 1px 3px;
		}
		75% {
			translate: -1px 2px;
		}
	}

	.tv :global(.ml .next) {
		background: var(--line);
	}

	.main {
		position: relative;
		min-height: 0;
		overflow: hidden;
	}

	.screen {
		height: 100%;
	}

	.tv :global(.cols) {
		display: grid;
		grid-template-columns: var(--cols);
		height: 100%;
		min-height: 0;
	}

	.tv :global(.cols > section) {
		display: grid;
		align-content: start;
		gap: 0.9em;
		min-width: 0;
		min-height: 0;
		padding: 1.3em 1.4em;
		overflow: hidden;
	}

	.tv :global(.cols > section.fill) {
		grid-template-rows: auto minmax(0, 1fr);
		align-content: stretch;
	}

	.tv :global(.cols > section + section) {
		border-left: 1px solid var(--line);
	}

	.tv :global(.tv-label) {
		font-size: 0.8em;
		font-weight: 500;
		line-height: inherit;
		letter-spacing: inherit;
		color: var(--text-2);
	}

	.tv :global(p) {
		margin: 0;
	}

	.message {
		display: grid;
		align-content: center;
		gap: 0.6em;
		height: 100%;
		padding: 0 3em;
	}

	.title {
		font-size: 2.4em;
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.sub {
		font-size: 1em;
		color: var(--text-2);
	}

	@media (orientation: portrait) {
		.tv {
			font-size: max(10px, min(2.45vw, 1.45vh));
		}

		.tv :global(.cols) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-template-rows: auto minmax(0, 1fr);
		}

		.tv :global(.cols > section:first-child) {
			grid-column: 1 / -1;
			border-bottom: 1px solid var(--line);
		}

		.tv :global(.cols > section:nth-child(2)) {
			border-left: 0;
		}
	}
</style>
