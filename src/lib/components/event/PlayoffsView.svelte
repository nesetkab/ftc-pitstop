<script lang="ts">
	import type { AllianceOdds } from '#lib/analysis/types.ts';
	import type { EventBundle } from '#lib/types.ts';
	import EmptyState, { type EmptyAction } from '#lib/ui/EmptyState.svelte';
	import AlliancesTable from './AlliancesTable.svelte';
	import Bracket from './Bracket.svelte';
	import { allianceStatus, buildBracket, playoffRecords } from './bracket.ts';

	interface Props {
		bundle: Pick<EventBundle, 'event' | 'teams' | 'matches' | 'alliances'>;
		odds?: AllianceOdds[] | null;
		followed?: ReadonlySet<number>;
		teams?: EmptyAction | null;
	}

	let { bundle, odds = null, followed = new Set(), teams = null }: Props = $props();

	const playoffMatches = $derived(bundle.matches.filter((match) => match.level === 'playoff'));
	const bracket = $derived(
		bundle.alliances.length > 0 || playoffMatches.length > 0
			? buildBracket(bundle.alliances, bundle.matches)
			: null
	);
	const records = $derived(playoffRecords(bundle.alliances, bundle.matches));
	const status = $derived(
		bracket
			? allianceStatus(
					bracket,
					bundle.alliances.map((alliance) => alliance.seed)
				)
			: new Map<number, string>()
	);
	const showOdds = $derived(odds !== null && odds.length > 0 && bracket?.champion == null);
</script>

{#if bundle.alliances.length === 0 && playoffMatches.length === 0}
	<EmptyState
		title="Alliances and the bracket show here after alliance selection."
		action={teams}
	/>
{:else}
	{#if bundle.alliances.length > 0}
		<section class="panel" aria-labelledby="alliances-title">
			<h2 class="sec-title" id="alliances-title">Alliances</h2>
			<AlliancesTable
				alliances={bundle.alliances}
				teams={bundle.teams}
				{records}
				{status}
				odds={showOdds ? odds : null}
				{followed}
			/>
		</section>
	{/if}
	{#if bracket}
		<section class="panel" aria-labelledby="bracket-title">
			<h2 class="visually-hidden" id="bracket-title">Bracket</h2>
			<Bracket code={bundle.event.code} {bracket} timezone={bundle.event.timezone} {followed} />
		</section>
	{/if}
{/if}

<style>
	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-title);
		align-content: start;
		min-width: 0;
	}
</style>
