<script lang="ts">
	import MatchBreakdown from '#lib/components/event/MatchBreakdown.svelte';
	import type { EventBundle, Match } from '#lib/types.ts';

	interface Props {
		code: string;
		matchKey: string;
		onclose: () => void;
	}

	let { code, matchKey, onclose }: Props = $props();

	let match = $state.raw<Match | null>(null);
	let status = $state<'loading' | 'ready' | 'failed'>('loading');
	let close: HTMLButtonElement | undefined = $state();

	$effect(() => close?.focus());

	// The screen's own data leaves breakdowns out, so fetch the full event when asked.
	$effect(() => {
		const key = matchKey;
		const controller = new AbortController();
		status = 'loading';
		fetch(`/api/events/${code}`, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error(`Event returned ${response.status}`);
				const bundle = (await response.json()) as EventBundle;
				match = bundle.matches.find((item) => item.key === key) ?? null;
				status = match?.result ? 'ready' : 'failed';
			})
			.catch(() => {
				if (!controller.signal.aborted) status = 'failed';
			});
		return () => controller.abort();
	});
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onclose()} />

<div class="dialog" role="dialog" aria-modal="true" aria-label="Score breakdown">
	<div class="head">
		<h2>{status === 'ready' && match ? `${match.label} score breakdown` : 'Score breakdown'}</h2>
		<button type="button" bind:this={close} onclick={onclose}>Close</button>
	</div>
	<div class="body">
		{#if status === 'loading'}
			<p>Loading…</p>
		{:else if status === 'ready' && match?.result}
			<p class="teams">
				Red {match.red.map((slot) => slot.team).join(', ')} · {match.result.red.total}
				<br />
				Blue {match.blue.map((slot) => slot.team).join(', ')} · {match.result.blue.total}
			</p>
			<MatchBreakdown result={match.result} />
		{:else}
			<p>The score breakdown couldn't be loaded. Close this and try again.</p>
		{/if}
	</div>
</div>

<style>
	.dialog {
		position: absolute;
		inset: 0;
		z-index: 5;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		background: var(--bg);
		color: var(--text);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1em;
		padding: 0.8em 1.4em;
		border-bottom: 1px solid var(--line);
	}

	h2 {
		margin: 0;
		font-size: 1.4em;
	}

	button {
		padding: 0.5em 1.2em;
		border: 1px solid var(--line);
		border-radius: 0.4em;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.body {
		justify-self: center;
		width: min(100%, 44rem);
		min-height: 0;
		padding: 1em 1.4em;
		overflow: auto;
	}

	.teams {
		margin-bottom: 1em;
	}
</style>
