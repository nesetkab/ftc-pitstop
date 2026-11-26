<script lang="ts">
	import { onMount } from 'svelte';
	import type { DataSource, Event } from '#lib/types.ts';
	import MatchDialog from './MatchDialog.svelte';
	import StreamBox from './StreamBox.svelte';
	import Takeover from './Takeover.svelte';
	import TvDone from './TvDone.svelte';
	import TvFooter from './TvFooter.svelte';
	import TvHeader from './TvHeader.svelte';
	import TvPlayoffs from './TvPlayoffs.svelte';
	import TvQuals from './TvQuals.svelte';
	import TvSelection from './TvSelection.svelte';
	import TvUpcoming from './TvUpcoming.svelte';
	import { absentText, heroText } from './copy.ts';
	import { BOARDS, layoutKey } from './layout.ts';
	import { provideOpenMatch } from './open-match.ts';
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

	let openKey = $state<string | null>(null);
	provideOpenMatch((key) => (openKey = key));

	const FOOTER_KEY = 'pitstop:footer';
	let footerHidden = $state(false);

	$effect(() => {
		try {
			footerHidden = localStorage.getItem(FOOTER_KEY) === 'hidden';
		} catch {
			// Storage can be blocked; the bar just stays visible.
		}
	});

	function hideFooter(hidden: boolean) {
		footerHidden = hidden;
		try {
			if (hidden) localStorage.setItem(FOOTER_KEY, 'hidden');
			else localStorage.removeItem(FOOTER_KEY);
		} catch {
			// Remembering is a convenience only.
		}
	}

	const HEADER_KEY = 'pitstop:header';
	let headerHidden = $state(false);

	$effect(() => {
		try {
			headerHidden = localStorage.getItem(HEADER_KEY) === 'hidden';
		} catch {
			// Storage can be blocked; the bar just stays visible.
		}
	});

	function hideHeader(hidden: boolean) {
		headerHidden = hidden;
		try {
			if (hidden) localStorage.setItem(HEADER_KEY, 'hidden');
			else localStorage.removeItem(HEADER_KEY);
		} catch {
			// Remembering is a convenience only.
		}
	}

	function resetLayout() {
		try {
			for (const board of BOARDS) localStorage.removeItem(layoutKey(board));
		} catch {
			// Nothing saved to clear.
		}
		window.dispatchEvent(new Event('pitstop:reset-layout'));
	}

	const showFooter = $derived(!footerHidden);

	// A queue call has to be seen, so close anything covering it.
	$effect(() => {
		if (takeover) openKey = null;
		const full = document.fullscreenElement;
		if (takeover && full && full !== document.documentElement) {
			document.exitFullscreen().catch(() => {});
		}
	});

	// Qualification and playoff screens place the stream in their own boxes (top left).
	// Every other screen keeps it in a column on the left.
	const boardPhase = $derived(view.phase === 'quals' || view.phase === 'playoffs');
	const sideStream = $derived(view.registered && streaming && !boardPhase);
	const streamEvent = $derived(streaming ? event : null);

	const timeZone = $derived(event.timezone);
	const absent = $derived(absentText(view));
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

<div
	class={['tv', 'pit', { 'no-header': headerHidden, 'no-footer': !showFooter }]}
	data-phase={view.phase}
>
	{#if headerHidden}
		<button type="button" class="show-header" onclick={() => hideHeader(false)}>
			Show top bar
		</button>
	{:else}
		<TvHeader
			eventName={event.name}
			team={view.team}
			teamName={view.teamName}
			{now}
			{timeZone}
			streaming={view.registered ? streaming : null}
			onstream={toggleStream}
			{footerHidden}
			onfooter={hideFooter}
			onreset={resetLayout}
			onhide={() => hideHeader(true)}
		/>
	{/if}
	<main class={['main', { side: sideStream }]}>
		{#if sideStream}<StreamBox {event} />{/if}
		<div class="content">
			{#if !view.registered}
				<div class="message">
					<p class="title">{absent.title}</p>
					<p class="sub">{absent.detail}</p>
				</div>
			{:else if view.phase === 'upcoming'}
				<TvUpcoming {view} {event} {now} {phoneUrl} />
			{:else if view.phase === 'quals'}
				<TvQuals {view} {call} {now} {timeZone} {streamEvent} />
			{:else if view.phase === 'selection'}
				<TvSelection {view} />
			{:else if view.phase === 'playoffs'}
				<TvPlayoffs {view} {call} {now} {timeZone} {streamEvent} />
			{:else}
				<TvDone {view} />
			{/if}
		</div>
	</main>
	{#if showFooter}
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
	{/if}
	{#if openKey}
		<MatchDialog code={event.code} matchKey={openKey} onclose={() => (openKey = null)} />
	{/if}
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

	.tv.no-footer {
		grid-template-rows: 2.6em minmax(0, 1fr);
	}

	.tv.no-header {
		grid-template-rows: minmax(0, 1fr) 2.1em;
	}

	.tv.no-header.no-footer {
		grid-template-rows: minmax(0, 1fr);
	}

	/* Faint until pointed at or tapped, so it stays out of the way. */
	.show-header {
		position: absolute;
		top: 0.3em;
		left: 50%;
		z-index: 4;
		padding: 0.3em 0.9em;
		border: 1px solid var(--line-2);
		border-radius: 0.4em;
		background: var(--bg);
		color: var(--text-2);
		font: inherit;
		font-size: 0.75em;
		cursor: pointer;
		translate: -50% 0;
		opacity: 0.25;
	}

	.show-header:hover,
	.show-header:focus-visible {
		opacity: 1;
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

	.tv :global(*) {
		scrollbar-width: thin;
		scrollbar-color: transparent transparent;
	}

	.tv :global(*:hover) {
		scrollbar-color: var(--line-2) transparent;
	}

	.tv :global(.ml .next) {
		background: var(--line);
	}

	.main {
		position: relative;
		min-height: 0;
		overflow: hidden;
	}

	.content {
		position: relative;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.main.side {
		display: grid;
		grid-template-columns: 36% minmax(0, 1fr);
	}

	/* Keep the pit info readable in the narrower column. */
	.main.side .content {
		font-size: min(0.8vw, 2.2222vh);
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

		.main.side {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: 30% minmax(0, 1fr);
		}
	}
</style>
