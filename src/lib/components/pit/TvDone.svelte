<script lang="ts">
	import { fixed } from '#lib/format/number.ts';
	import { ordinal } from '#lib/format/ordinal.ts';
	import { record } from '#lib/format/record.ts';
	import RankTable from './RankTable.svelte';
	import RowFit from './RowFit.svelte';
	import { awardName, playoffResult } from './copy.ts';
	import type { PitView } from './view.ts';

	interface Props {
		view: PitView;
	}

	let { view }: Props = $props();

	const ranking = $derived(view.ranking);
	const result = $derived(playoffResult(view));
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
	<section class="fill event-awards">
		<h2 class="tv-label">Awards</h2>
		{#if view.eventAwards.length > 0}
			<RowFit count={view.eventAwards.length}>
				{#snippet children(shown)}
					{@const cut = shown < view.eventAwards.length}
					<ul class="awards">
						{#each view.eventAwards.slice(0, cut ? shown - 1 : shown) as award (`${award.id}-${award.placement}-${award.team}`)}
							<li class={{ mine: award.team === view.team }}>
								<span class="name">{awardName(award.name)}</span>
								<span class="winner">
									<b>{award.team}</b>
									{view.names.get(award.team ?? 0) ?? ''}
								</span>
							</li>
						{/each}
						{#if cut}
							<li class="more">{view.eventAwards.length - shown + 1} more</li>
						{/if}
					</ul>
				{/snippet}
			</RowFit>
		{:else if !view.hasPlayoffs}
			<p class="sub">League meets don't give awards.</p>
		{:else}
			<p class="sub">Awards haven't been posted yet.</p>
		{/if}
	</section>
	<section class="fill">
		<h2 class="tv-label">Final rankings</h2>
		{#if view.rankings.length > 0}
			<RankTable
				rankings={view.rankings}
				team={view.team}
				names={view.names}
				caption="Final rankings"
			/>
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
	}

	.awards li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: center;
		gap: 0.8em;
		padding-inline: 0.5em;
		box-shadow: inset 0 -1px var(--line);
		white-space: nowrap;
	}

	.awards li.mine {
		box-shadow: none;
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 600;
	}

	.awards li.more {
		display: flex;
		color: var(--text-3);
	}

	.awards .name {
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-2);
	}

	.awards li.mine .name {
		color: var(--on-accent);
	}

	@media (orientation: portrait) {
		.event-awards :global(.fit) {
			--row: 2.75;
		}

		.awards li {
			grid-template-columns: minmax(0, 1fr);
			align-content: center;
			gap: 0;
		}
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
