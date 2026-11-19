<script lang="ts">
	import { pct } from '#lib/format/pct.ts';
	import AllianceTag from './AllianceTag.svelte';
	import Matchup from './Matchup.svelte';
	import { heroText } from './copy.ts';
	import type { QueueCall } from './queue.ts';
	import type { NextMatch } from './view.ts';

	interface Props {
		next: NextMatch;
		call: QueueCall | null;
		now: number;
		timeZone: string;
		delaySeconds: number | null;
		showRp?: boolean;
	}

	let { next, call, now, timeZone, delaySeconds, showRp = true }: Props = $props();

	const text = $derived(heroText(next, call, now, timeZone, delaySeconds));
	const rp = $derived(showRp ? (next.forecast?.[next.alliance].rp ?? null) : null);
</script>

<span class="label">Next match</span>
<div class="hero">
	<b>{next.label}</b>
	<AllianceTag alliance={next.alliance} />
</div>
<div class={['queue', { urgent: text.urgent }]}>
	<b>{text.headline}</b>
	{#if text.detail.length > 0}
		<span>{text.detail.join(' ')}</span>
	{/if}
</div>
<Matchup {next} />
{#if rp}
	<span class="label">Ranking point chances for {next.alliance}</span>
	<div class="rp">
		<div><span>Swarm</span><b>{pct(rp.swarm)}</b></div>
		<div><span>Pollinator 1</span><b>{pct(rp.pollinator1)}</b></div>
		<div><span>Pollinator 2</span><b>{pct(rp.pollinator2)}</b></div>
	</div>
{/if}

<style>
	.hero {
		display: flex;
		align-items: baseline;
		gap: 0.5em;
	}

	.hero b {
		font-size: 6.4em;
		line-height: 0.95;
		font-weight: 650;
		letter-spacing: -0.03em;
	}

	.queue {
		display: grid;
		gap: 0.2em;
	}

	.queue b {
		font-size: 2.4em;
		line-height: 1.05;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.queue.urgent b {
		color: var(--accent);
	}

	.queue span {
		font-size: 0.9em;
		color: var(--text-2);
	}

	.rp {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.6em;
		font-size: 0.82em;
	}

	.rp div {
		display: grid;
		gap: 0.15em;
	}

	.rp span {
		font-size: 0.85em;
		color: var(--text-2);
	}

	.rp b {
		font-size: 1.15em;
		font-weight: 600;
	}
</style>
