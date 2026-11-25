<script lang="ts">
	import type { EventAnalysis } from '#lib/analysis/types.ts';
	import { RP_THRESHOLDS } from '#lib/game/biobuzz.ts';
	import { LEAGUE_MATCHES } from '#lib/game/rankings.ts';
	import type { EventBundle } from '#lib/types.ts';
	import DownloadLink from '#lib/ui/DownloadLink.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Legend from '#lib/ui/Legend.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import ColumnMenu from './ColumnMenu.svelte';
	import { quals } from './matches.ts';
	import {
		availableSources,
		DEFAULT_CHOICE,
		rankingPageQuery,
		rankingQuery,
		rankingRows,
		scoreStats,
		sortRankingRows,
		visibleColumns,
		type RankingChoice,
		type RankingView
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
		view?: RankingView;
		path?: string;
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
		view = 'standings',
		path = '',
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
	const views = $derived(
		(
			[
				{ value: 'standings', label: 'Standings', shown: true },
				{ value: 'rp', label: 'Ranking points', shown: rp !== null },
				{ value: 'schedule', label: 'Schedule strength', shown: strength.length > 0 }
			] as const
		)
			.filter((option) => option.shown)
			.map(({ value, label }) => ({ value, label, href: link(rankingPageQuery(choice, value)) }))
	);
	const active = $derived(views.some((option) => option.value === view) ? view : 'standings');
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
	function link(query: string) {
		return query || path || '?';
	}

	const caveat = $derived(
		[
			elsewhere
				? "These are league rankings, so they include teams that didn't play at this meet."
				: null,
			league
				? `League rankings use each team's best ${league} league matches so far. RS, TBP and the record add up those matches, and RS and TBP are divided by ${league} even for teams that have played fewer.`
				: null,
			meetOnly
				? `FIRST's rankings aren't loading, so these count this event's matches only. FIRST's league rankings also add each team's best ${LEAGUE_MATCHES} matches from earlier meets.`
				: null
		]
			.filter(Boolean)
			.join(' ')
	);

	const note = $derived(
		[
			shown.has('rs') && !league ? 'RS is the average ranking points per match.' : null,
			shown.has('tbp') && !league
				? 'TBP is the average match score without penalties. Matches a team was disqualified from or missed count as zero.'
				: null,
			shown.has('avgtips') ? 'Avg tips is the average hive tips per match.' : null,
			sources.has('score') && ['npavg', 'npmax', 'npmin', 'npsd'].some((key) => shown.has(key))
				? 'NP scores leave out points from opponent fouls and count qualification matches only.'
				: null,
			sources.has('score') && shown.has('npsd') ? 'Spread is how much those scores vary.' : null,
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
	{#if views.length > 1 || (onchoose && active === 'standings')}
		<div class="bar">
			{#if views.length > 1}
				<Segmented label="Rankings view" options={views} value={active} />
			{/if}
			{#if onchoose && active === 'standings'}
				<span class="menu"><ColumnMenu {choice} {sources} {onchoose} /></span>
			{/if}
		</div>
	{/if}
	{#if active === 'rp' && rp}
		<RpSources {rp} rankings={bundle.rankings} teams={bundle.teams} {followed} {eventCode} />
		<Legend>
			Share of each team's qualification matches where its alliance won or earned each bonus ranking
			point. Swarm takes {RP_THRESHOLDS.swarm} leave and park points, Pollinator 1 takes {RP_THRESHOLDS.pollinator1}
			tips and Pollinator 2 takes {RP_THRESHOLDS.pollinator2}. Bonus RS is bonus ranking points per
			match, the part of RS that doesn't depend on winning.
		</Legend>
	{:else if active === 'schedule'}
		<StrengthTable
			title={strengthTitle}
			{strength}
			rankings={bundle.rankings}
			teams={bundle.teams}
			{followed}
			{eventCode}
		/>
		<Legend>
			Partners' and opponents' OPR are averages over the matches each team has played{remaining > 0
				? ' so far'
				: ''}. Difference is partners minus opponents, so a team above zero had the easier schedule.
		</Legend>
	{:else}
		<RankingsTable
			{rows}
			teams={bundle.teams}
			{columns}
			{choice}
			projected={projections !== null && projections.length > 0}
			qualCount={qualMatches.length}
			hrefFor={(next) => link(rankingQuery(next))}
			{onchoose}
			{followed}
			{eventCode}
		/>
		{#if caveat}<p class="note">{caveat}</p>{/if}
		{#if note}<Legend>{note}</Legend>{/if}
		{#if csvHref}
			<p class="csv"><DownloadLink href="{csvHref}{query}" /></p>
		{/if}
	{/if}
{/if}

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		align-items: center;
	}

	.menu {
		margin-left: auto;
	}

	:global(.table-wrap.ranked .rank) {
		box-sizing: border-box;
		width: 64px;
	}

	@media (max-width: 600px) {
		.bar {
			column-gap: 8px;
		}

		:global(.table-wrap.ranked .rank) {
			width: 54px;
		}

		:global(.table-wrap.rp .team-cell .name) {
			max-width: min(6em, 19vw);
		}
	}

	.csv {
		font-size: 14px;
	}
</style>
