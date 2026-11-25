<script lang="ts">
	import { fixed, integer, MISSING, record, signed } from '#lib/format/index.ts';
	import { regionName } from '#lib/format/places.ts';
	import TrendSpark from './TrendSpark.svelte';
	import type { ChartPoint, TeamPageData } from './team-view.ts';

	interface Props {
		stats: TeamPageData['stats'];
		team?: number;
		trend?: ChartPoint[];
	}

	let { stats, team, trend = [] }: Props = $props();

	const change = $derived(trend.length > 1 ? trend[trend.length - 1].value - trend[0].value : null);
	const worldHref = $derived(team ? `/leaderboards?team=${team}` : undefined);
	const region = $derived(stats.region ? regionName(stats.region.code) : null);
	const regionHref = $derived(
		team && stats.region ? `/leaderboards?region=${stats.region.code}&team=${team}` : undefined
	);
</script>

<dl class="stats">
	<div class="lead">
		<dt>Season aOPR</dt>
		<dd>{fixed(stats.opr)}</dd>
	</div>
	{#if change !== null}
		<div class="spark">
			<dt>aOPR by event</dt>
			<dd class="trend">
				<TrendSpark points={trend} width={150} height={44} />
				<small>{signed(change)} since first event</small>
			</dd>
		</div>
	{/if}
	<div>
		<dt>World rank by aOPR</dt>
		<dd>
			{#if stats.rank !== null && stats.of !== null}
				{#if worldHref}
					<a href={worldHref} title="Find {team} on the leaderboard">{integer(stats.rank)}</a>
				{:else}
					{integer(stats.rank)}
				{/if}
				<small>of {integer(stats.of)}</small>
			{:else}
				{MISSING}
			{/if}
		</dd>
	</div>
	{#if stats.region}
		<div>
			<dt>Rank in <a href="/regions/{stats.region.code}">{region}</a></dt>
			<dd>
				<a href={regionHref} title="Find {team} on the {region} leaderboard"
					>{integer(stats.region.rank)}</a
				>
				<small>of {integer(stats.region.of)}</small>
			</dd>
		</div>
	{/if}
	<div>
		<dt>Qual record</dt>
		<dd>
			{#if stats.record}
				{record(stats.record.wins, stats.record.losses, stats.record.ties)}
				<small>in {stats.events} {stats.events === 1 ? 'event' : 'events'}</small>
			{:else}
				{MISSING}
			{/if}
		</dd>
	</div>
</dl>

<style>
	.stats {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 16px 36px;
		margin: 0;
	}

	.stats div {
		display: flex;
		flex-direction: column-reverse;
		gap: 2px;
	}

	dt {
		font-size: 13px;
		color: var(--text-2);
	}

	dd {
		margin: 0;
		font-size: 22px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	dd a {
		text-decoration: underline;
		text-decoration-color: var(--line-2);
		text-underline-offset: 4px;
	}

	dd a:hover,
	dt a:hover {
		text-decoration-color: currentColor;
	}

	dt a {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--line-2);
	}

	.lead dd {
		font-size: 52px;
		line-height: 1;
		letter-spacing: -0.03em;
	}

	.lead dt {
		font-size: 14px;
	}

	.spark dt {
		color: var(--text-3);
	}

	.trend {
		display: grid;
		gap: 2px;
	}

	small {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-2);
	}

	@media (max-width: 600px) {
		.stats {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 14px 20px;
		}

		.lead dd {
			font-size: 44px;
		}

		.stats > div:last-child:nth-child(odd) {
			grid-column: 1 / -1;
		}
	}
</style>
