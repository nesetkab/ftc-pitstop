<script lang="ts">
	import { pct } from '#lib/format/pct.ts';
	import MatchList from '#lib/ui/MatchList.svelte';
	import NextHero from './NextHero.svelte';
	import TeamTag from './TeamTag.svelte';
	import { lastResultItem, matchItems, playoffResult } from './copy.ts';
	import type { QueueCall } from './queue.ts';
	import type { PitView } from './view.ts';

	interface Props {
		view: PitView;
		call: QueueCall | null;
		now: number;
		timeZone: string;
	}

	let { view, call, now, timeZone }: Props = $props();

	const playoff = $derived(view.playoff);
	const next = $derived(view.next?.level === 'playoff' ? view.next : null);
	const result = $derived(playoffResult(view));
	const members = $derived(
		playoff?.alliance
			? [
					playoff.alliance.captain,
					...playoff.alliance.picks,
					...(playoff.alliance.backup ? [playoff.alliance.backup] : [])
				]
			: []
	);
</script>

<div class="cols" style:--cols="31em 23em minmax(0, 1fr)">
	<section>
		{#if next}
			<NextHero {next} {call} {now} {timeZone} delaySeconds={view.delaySeconds} showRp={false} />
			{#if playoff?.position}
				<p class="sub">{playoff.position}</p>
			{/if}
		{:else}
			<h2 class="tv-label">Playoffs</h2>
			<p class={['status', { won: playoff?.state === 'won' }]}>
				{result ?? 'Waiting for the next match'}
			</p>
			{#if playoff?.state === 'alive' || playoff?.state === 'waiting'}
				<p class="sub">Our next match shows up here when it is scheduled.</p>
			{/if}
		{/if}
	</section>
	<section>
		<h2 class="tv-label">Our alliance</h2>
		{#if playoff?.alliance}
			<p class="seed">Alliance {playoff.alliance.seed}</p>
			<ul class="members">
				{#each members as number (number)}
					<li>
						<TeamTag {number} me={number === view.team} />
						<span>{view.names.get(number) ?? ''}</span>
					</li>
				{/each}
			</ul>
			<p class="sub">
				Playoff record {playoff.wins}-{playoff.losses}{playoff.winEvent !== null
					? `. Chance to win the event ${pct(playoff.winEvent)}.`
					: '.'}
			</p>
		{:else}
			<p class="sub">{view.team} is not on a playoff alliance.</p>
		{/if}
		{#if playoff && playoff.matches.length > 0}
			<h2 class="tv-label">Our playoff matches</h2>
			<MatchList items={matchItems(playoff.matches, next?.key ?? null, timeZone, now)} />
		{/if}
	</section>
	<section>
		<h2 class="tv-label">Alliances</h2>
		<ol class="standings">
			{#each view.standings as standing (standing.seed)}
				<li class={{ mine: standing.seed === playoff?.alliance?.seed, out: standing.out }}>
					<span class="number">{standing.seed}</span>
					<span class="teams">
						{#each standing.teams as number (number)}
							<TeamTag {number} me={number === view.team} />
						{/each}
					</span>
					<span class="record">
						{standing.won ? 'Won' : standing.out ? 'Out' : `${standing.wins}-${standing.losses}`}
					</span>
				</li>
			{/each}
		</ol>
		{#if view.lastResult}
			<h2 class="tv-label">Last result</h2>
			<MatchList items={[lastResultItem(view.lastResult)]} />
		{/if}
	</section>
</div>

<style>
	.status {
		font-size: 2.4em;
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.status.won {
		color: var(--accent);
	}

	.sub {
		font-size: 0.9em;
		color: var(--text-2);
	}

	.seed {
		font-size: 1.6em;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.members {
		display: grid;
		gap: 0.4em;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.members li {
		display: flex;
		align-items: center;
		gap: 0.6em;
		font-size: 1.1em;
	}

	.members span {
		color: var(--text-2);
	}

	.standings {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.standings li {
		display: grid;
		grid-template-columns: 1.6em minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.6em;
		padding: 0.5em 0;
		border-bottom: 1px solid var(--line);
	}

	.standings li.mine {
		margin: 0 -0.5em;
		padding-inline: 0.5em;
		background: var(--line);
	}

	.standings li.out .teams,
	.standings li.out .record,
	.standings li.out .number {
		color: var(--text-3);
		opacity: 0.75;
	}

	.number {
		font-size: 1.3em;
		font-weight: 600;
	}

	.teams {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4em;
		font-size: 1.05em;
	}

	.record {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
</style>
