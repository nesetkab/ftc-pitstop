<script lang="ts">
	import type { EventAnalysis } from '#lib/analysis/types.ts';
	import type { EventBundle } from '#lib/types.ts';
	import DownloadLink from '#lib/ui/DownloadLink.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
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
			league ? `League rankings use each team's best ${league} league matches so far.` : null,
			meetOnly ? "FIRST's rankings aren't loading, so these count this event's matches only." : null
		]
			.filter(Boolean)
			.join(' ')
	);

	const projected = $derived(projections !== null && projections.length > 0);
</script>

{#if bundle.rankings.length === 0}
	<EmptyState title="Rankings show here after the first qualification match." />
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
	{:else if active === 'schedule'}
		<StrengthTable
			title={strengthTitle}
			{strength}
			rankings={bundle.rankings}
			teams={bundle.teams}
			{followed}
			{eventCode}
		/>
		<p class="note">A team with a difference above zero had the easier schedule.</p>
	{:else}
		<RankingsTable
			{rows}
			teams={bundle.teams}
			{columns}
			{choice}
			{projected}
			qualCount={qualMatches.length}
			hrefFor={(next) => link(rankingQuery(next))}
			{onchoose}
			{followed}
			{eventCode}
		/>
		{#if caveat}<p class="note">{caveat}</p>{/if}
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
