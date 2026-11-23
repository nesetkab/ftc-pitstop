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
		label?: string;
	}

	let {
		next,
		call,
		now,
		timeZone,
		delaySeconds,
		showRp = true,
		label = 'Next match'
	}: Props = $props();

	const text = $derived(heroText(next, call, now, timeZone, delaySeconds));
	const rp = $derived(showRp ? (next.forecast?.[next.alliance].rp ?? null) : null);
</script>

<h2 class="tv-label">{label}</h2>
<div class="hero">
	<b>{next.label}</b>
	<AllianceTag alliance={next.alliance} />
</div>
<div class={['queue', { urgent: text.urgent }]}>
	<b>{text.headline}</b>
	{#if text.facts.length > 0}
		<dl>
			{#each text.facts as fact (fact.label)}
				<div>
					<dt>{fact.label}</dt>
					<dd>{fact.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
</div>
<Matchup {next} />
{#if rp}
	<h2 class="tv-label">Ranking point chances for {next.alliance}</h2>
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

	.queue dl {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4em 1.6em;
		margin: 0.4em 0 0;
	}

	.queue dl div {
		display: grid;
		gap: 0.1em;
	}

	.queue dt {
		font-size: 0.74em;
		color: var(--text-2);
	}

	.queue dd {
		margin: 0;
		font-size: 1.15em;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
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
