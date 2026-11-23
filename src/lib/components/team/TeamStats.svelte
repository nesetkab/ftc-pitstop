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
	<div>
		<dt>Season OPR</dt>
		<dd>{fixed(stats.opr)}</dd>
	</div>
	<div>
		<dt>World rank by OPR</dt>
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
			<dt>Rank in {region}</dt>
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
		<dd title="Qualification matches at every event this season. Playoffs are not counted.">
			{stats.record ? record(stats.record.wins, stats.record.losses, stats.record.ties) : MISSING}
		</dd>
	</div>
	<div>
		<dt>Events played</dt>
		<dd>{stats.events}</dd>
	</div>
	{#if change !== null}
		<div>
			<dt>OPR by event</dt>
			<dd class="trend">
				<TrendSpark points={trend} />
				<small>{signed(change)} since first</small>
			</dd>
		</div>
	{/if}
</dl>

<style>
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 32px;
		margin: 0;
	}

	.stats div {
		display: grid;
		gap: 2px;
		align-content: start;
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

	dd a:hover {
		text-decoration-color: currentColor;
	}

	.trend {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 33px;
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
	}
</style>
