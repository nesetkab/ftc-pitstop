<script lang="ts">
	import { fixed } from '#lib/format/number.ts';
	import { ordinal } from '#lib/format/ordinal.ts';
	import { record } from '#lib/format/record.ts';
	import RankTable from './RankTable.svelte';
	import { awardName, playoffResult } from './copy.ts';
	import { rankWindow, type PitView } from './view.ts';

	interface Props {
		view: PitView;
		rankRows?: number;
	}

	let { view, rankRows = 27 }: Props = $props();

	const ranking = $derived(view.ranking);
	const result = $derived(playoffResult(view));
	const rows = $derived(rankWindow(view.rankings, view.team, rankRows));
</script>

<div class="cols" style:--cols="31em minmax(0, 1fr) 23em">
	<section>
		<h2 class="tv-label">Final rank</h2>
		{#if ranking}
			<div class="hero">
				<b>{ordinal(ranking.rank)}</b>
				<span>of {view.teamCount}</span>
			</div>
			<p class="line">
				{record(ranking.wins, ranking.losses, ranking.ties)} with an RS of {fixed(ranking.rs, 2)}
			</p>
		{:else}
			<p class="line">No qualification matches played.</p>
		{/if}
		{#if result}
			<p class={['result', { won: view.playoff?.state === 'won' }]}>{result}</p>
		{/if}
		{#if view.advancing && view.advancesTo}
			<p class="sub">Advancing to {view.advancesTo}.</p>
		{/if}
		{#if view.awards.length > 0}
			<h2 class="tv-label">Our awards</h2>
			<ul class="ours">
				{#each view.awards as award (`${award.id}-${award.placement}`)}
					<li>{awardName(award.name)}</li>
				{/each}
			</ul>
		{/if}
	</section>
	<section>
		<h2 class="tv-label">Awards</h2>
		{#if view.eventAwards.length > 0}
			<ul class="awards">
				{#each view.eventAwards as award (`${award.id}-${award.placement}-${award.team}`)}
					<li class={{ mine: award.team === view.team }}>
						<span class="name">{awardName(award.name)}</span>
						<span class="winner">
							<b>{award.team}</b>
							{view.names.get(award.team ?? 0) ?? ''}
						</span>
					</li>
				{/each}
			</ul>
		{:else if !view.hasPlayoffs}
			<p class="sub">League meets don't give awards.</p>
		{:else}
			<p class="sub">Awards haven't been posted yet.</p>
		{/if}
	</section>
	<section>
		<h2 class="tv-label">Final rankings</h2>
		{#if rows.length > 0}
			<RankTable {rows} team={view.team} names={view.names} caption="Final rankings" />
		{/if}
	</section>
</div>

<style>
	.hero {
		display: flex;
		align-items: baseline;
		gap: 0.4em;
	}

	.hero b {
		font-size: 6.4em;
		line-height: 0.95;
		font-weight: 650;
		letter-spacing: -0.03em;
	}

	.hero span {
		font-size: 1.6em;
		color: var(--text-2);
	}

	.line {
		font-size: 1.6em;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.result {
		font-size: 2.4em;
		line-height: 1.1;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.result.won {
		color: var(--accent);
	}

	.sub {
		font-size: 0.9em;
		color: var(--text-2);
	}

	.ours {
		display: grid;
		gap: 0.3em;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 1.3em;
		font-weight: 600;
	}

	.awards {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.72em;
	}

	.awards li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.8em;
		padding: 0.26em 0;
		border-bottom: 1px solid var(--line);
	}

	.awards li.mine {
		margin: 0 -0.5em;
		padding-inline: 0.5em;
		background: var(--accent-wash);
	}

	.awards .name {
		color: var(--text-2);
	}

	.awards li.mine .name {
		color: var(--text);
	}

	.winner {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.winner b {
		font-weight: 600;
		margin-right: 0.3em;
	}
</style>
