<script lang="ts">
	import type { EventAnalysis } from '#lib/analysis/types.ts';
	import { RP_THRESHOLDS } from '#lib/game/biobuzz.ts';
	import { LEAGUE_MATCHES } from '#lib/game/rankings.ts';
	import type { EventBundle } from '#lib/types.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import ColumnMenu from './ColumnMenu.svelte';
	import { quals } from './matches.ts';
	import {
		availableSources,
		DEFAULT_CHOICE,
		rankingQuery,
		rankingRows,
		scoreStats,
		sortRankingRows,
		visibleColumns,
		type RankingChoice
	} from './ranking-columns.ts';
	import RankingsTable from './RankingsTable.svelte';
	import RpSources from './RpSources.svelte';
	import type { RpCounts } from './standings.ts';
	import StrengthTable from './StrengthTable.svelte';

	interface Props {
		bundle: Pick<EventBundle, 'teams' | 'matches' | 'rankings'> &
			Partial<Pick<EventBundle, 'source'>> & {
				event?: Pick<EventBundle['event'], 'type'>;
			};
		analysis?: Pick<EventAnalysis, 'ratings' | 'projections' | 'strength'> | null;
		rp?: Record<number, RpCounts> | null;
		followed?: ReadonlySet<number>;
		csvHref?: string;
		choice?: RankingChoice;
		onchoose?: (choice: RankingChoice) => void;
		eventCode?: string;
	}

	let {
		bundle,
		analysis = null,
		rp = null,
		followed = new Set(),
		csvHref,
		choice = DEFAULT_CHOICE,
		onchoose,
		eventCode
	}: Props = $props();

	const qualMatches = $derived(quals(bundle.matches));
	const remaining = $derived(qualMatches.filter((match) => !match.result).length);
	const stats = $derived(scoreStats(qualMatches));
	const projections = $derived(remaining > 0 ? (analysis?.projections ?? null) : null);
	const ratings = $derived(analysis && analysis.ratings.length > 0 ? analysis.ratings : null);
	const sources = $derived(availableSources(ratings, stats));
	const columns = $derived(visibleColumns(choice, sources));
	const shown = $derived(new Set(columns.map((column) => column.key)));
	const rows = $derived(
		sortRankingRows(rankingRows(bundle.rankings, ratings, stats, projections), choice)
	);
	const query = $derived(rankingQuery(choice));
	const strength = $derived(analysis?.strength ?? []);
	const strengthTitle = $derived(remaining > 0 ? 'Schedule so far' : 'Schedule strength');
	const elsewhere = $derived.by(() => {
		const here = new Set(bundle.teams.map((team) => team.number));
		return here.size > 0 && bundle.rankings.some((row) => !here.has(row.team));
	});
	const league = $derived(
		bundle.event?.type === 'LeagueMeet'
			? Math.max(0, ...bundle.rankings.map((row) => row.counted ?? 0))
			: 0
	);
	const meetOnly = $derived(
		bundle.source === 'ftcscout' &&
			!league &&
			(bundle.event?.type === 'LeagueMeet' || bundle.event?.type === 'LeagueTournament')
	);
	const note = $derived(
		[
			elsewhere
				? "These are league rankings, so they include teams that didn't play at this meet."
				: null,
			league
				? `League rankings use each team's best ${league} league matches so far. RS, TBP and the record add up those matches, and RS and TBP are divided by ${league} even for teams that have played fewer.`
				: null,
			meetOnly
				? `FIRST's rankings aren't loading, so these count this event's matches only. FIRST's league rankings also add each team's best ${LEAGUE_MATCHES} matches from earlier meets.`
				: null,
			shown.has('rs') && !league ? 'RS is the average ranking points per match.' : null,
			shown.has('tbp') && !league
				? 'TBP is the average match score without penalties. Matches a team was disqualified from or missed count as zero.'
				: null,
			sources.has('score') && ['npavg', 'npmax', 'npmin', 'npsd'].some((key) => shown.has(key))
				? 'NP scores leave out points from opponent fouls and count qualification matches only. Spread is how much those scores vary.'
				: null,
			sources.has('rating') ? "OPR is each team's estimated share of its alliance's score." : null,
			projections
				? `Projections play out the ${remaining} remaining qualification ${remaining === 1 ? 'match' : 'matches'}.`
				: null
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#if bundle.rankings.length === 0}
	<EmptyState title="No rankings yet.">
		Rankings show here after the first qualification match is played.
	</EmptyState>
{:else}
	<div class="bar">
		<p class="note">Click a column to sort by it.</p>
		{#if onchoose}
			<ColumnMenu {choice} {sources} {onchoose} />
		{/if}
	</div>
	<RankingsTable
		{rows}
		teams={bundle.teams}
		{columns}
		{choice}
		projected={projections !== null && projections.length > 0}
		qualCount={qualMatches.length}
		hrefFor={(next) => rankingQuery(next) || '?'}
		{onchoose}
		{followed}
		{eventCode}
	/>
	<p class="note">{note}</p>
	{#if csvHref}
		<p class="csv"><a href="{csvHref}{query}" download>Download CSV</a></p>
	{/if}
	{#if rp}
		<section class="panel" aria-labelledby="rp-title">
			<h2 class="sec-title" id="rp-title">Where ranking points came from</h2>
			<RpSources {rp} rankings={bundle.rankings} teams={bundle.teams} {followed} />
			<p class="note">
				Share of each team's qualification matches where its alliance won or earned each bonus
				ranking point. Swarm takes {RP_THRESHOLDS.swarm} leave and park points, Pollinator 1 takes {RP_THRESHOLDS.pollinator1}
				tips and Pollinator 2 takes {RP_THRESHOLDS.pollinator2}. Bonus RS is bonus ranking points
				per match, the part of RS that doesn't depend on winning.
			</p>
		</section>
	{/if}
	{#if strength.length > 0}
		<section class="panel" aria-labelledby="strength-title">
			<h2 class="sec-title" id="strength-title">{strengthTitle}</h2>
			<StrengthTable
				title={strengthTitle}
				{strength}
				rankings={bundle.rankings}
				teams={bundle.teams}
				{followed}
			/>
			<p class="note">
				Partners' and opponents' OPR are averages over the matches each team has played. Sorted by
				the gap between rank and rank by OPR.
			</p>
		</section>
	{/if}
{/if}

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		align-items: center;
		justify-content: space-between;
	}

	.bar .note {
		margin: 0;
	}

	.csv {
		font-size: 14px;
	}

	@media (pointer: coarse) {
		.csv a {
			display: inline-block;
			margin-block: -10px;
			padding-block: 10px;
		}
	}

	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
		align-content: start;
		min-width: 0;
	}
</style>
