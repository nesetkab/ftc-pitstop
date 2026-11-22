<script lang="ts">
	import type { EventAnalysis } from '#lib/analysis/types.ts';
	import type { EventBundle } from '#lib/types.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { quals } from './matches.ts';
	import RankingsTable from './RankingsTable.svelte';
	import StrengthTable from './StrengthTable.svelte';

	interface Props {
		bundle: Pick<EventBundle, 'teams' | 'matches' | 'rankings'>;
		analysis?: Pick<EventAnalysis, 'ratings' | 'projections' | 'strength'> | null;
		followed?: ReadonlySet<number>;
	}

	let { bundle, analysis = null, followed = new Set() }: Props = $props();

	const qualMatches = $derived(quals(bundle.matches));
	const remaining = $derived(qualMatches.filter((match) => !match.result).length);
	const projections = $derived(remaining > 0 ? (analysis?.projections ?? null) : null);
	const ratings = $derived(analysis && analysis.ratings.length > 0 ? analysis.ratings : null);
	const strength = $derived(analysis?.strength ?? []);
	const strengthTitle = $derived(remaining > 0 ? 'Schedule so far' : 'Schedule strength');
	const note = $derived(
		[
			'RS is the average ranking points per match.',
			'TBP is the average match score without penalties.',
			ratings ? "OPR is each team's estimated share of its alliance's score." : null,
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
	<RankingsTable
		rankings={bundle.rankings}
		teams={bundle.teams}
		{ratings}
		{projections}
		qualCount={qualMatches.length}
		{followed}
	/>
	<p class="note">{note}</p>
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
	.panel {
		display: grid;
		gap: 10px;
		align-content: start;
		min-width: 0;
	}

	h2.sec-title {
		font-size: 15px;
		line-height: 1.4;
		letter-spacing: 0;
	}
</style>
