<script lang="ts">
	import type { AllianceOdds } from '#lib/analysis/types.ts';
	import type { EventBundle } from '#lib/types.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import AlliancesTable from './AlliancesTable.svelte';
	import Bracket from './Bracket.svelte';
	import { buildBracket, playoffRecords } from './bracket.ts';

	interface Props {
		bundle: Pick<EventBundle, 'event' | 'teams' | 'matches' | 'alliances'>;
		odds?: AllianceOdds[] | null;
		followed?: ReadonlySet<number>;
	}

	let { bundle, odds = null, followed = new Set() }: Props = $props();

	const playoffMatches = $derived(bundle.matches.filter((match) => match.level === 'playoff'));
	const bracket = $derived(
		bundle.alliances.length > 0 || playoffMatches.length > 0
			? buildBracket(bundle.alliances, bundle.matches)
			: null
	);
	const records = $derived(playoffRecords(bundle.alliances, bundle.matches));
	const showOdds = $derived(odds !== null && odds.length > 0 && bracket?.champion == null);
</script>

{#if bundle.alliances.length === 0 && playoffMatches.length === 0}
	<EmptyState title="Alliances haven't been picked yet.">
		Alliances and the playoff bracket show here after alliance selection.
	</EmptyState>
{:else}
	{#if bundle.alliances.length > 0}
		<section class="panel" aria-labelledby="alliances-title">
			<h2 class="sec-title" id="alliances-title">Alliances</h2>
			<AlliancesTable
				alliances={bundle.alliances}
				teams={bundle.teams}
				{records}
				odds={showOdds ? odds : null}
				{followed}
			/>
			{#if showOdds}
				<p class="note">Chances to win the event play out the rest of the bracket using OPR.</p>
			{/if}
		</section>
	{/if}
	{#if bracket}
		<section class="panel" aria-labelledby="bracket-title">
			<h2 class="sec-title" id="bracket-title">Bracket</h2>
			<Bracket code={bundle.event.code} {bracket} timezone={bundle.event.timezone} {followed} />
		</section>
	{/if}
{/if}

<style>
	.panel {
		display: grid;
		gap: 12px;
		align-content: start;
		min-width: 0;
	}

	h2.sec-title {
		font-size: 15px;
		line-height: 1.4;
		letter-spacing: 0;
	}
</style>
