<script lang="ts">
	import AllianceFit from '#lib/components/compare/AllianceFit.svelte';
	import CompareTable from '#lib/components/compare/CompareTable.svelte';
	import HeadToHead from '#lib/components/compare/HeadToHead.svelte';
	import SharedEvents from '#lib/components/compare/SharedEvents.svelte';
	import TeamPicker from '#lib/components/compare/TeamPicker.svelte';
	import { compareHref } from '#lib/components/compare/compare.ts';
	import { MAX_FIT } from '#lib/components/compare/fit.ts';
	import { sidesFrom, simulateHref } from '#lib/components/simulate/simulate.ts';
	import { siteTitle } from '#lib/seo.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = $derived(data.view);
	const paired = $derived(view.teams.length >= 2);
	const names = $derived(view.teams.map((team) => `${team.number} ${team.name}`));
	const title = $derived(
		paired
			? siteTitle(`${view.teams.map((team) => team.number).join(' vs ')}, compare FTC teams`)
			: siteTitle('Compare FTC teams')
	);
	const description = $derived(
		paired
			? `Compare FTC teams ${names.slice(0, -1).join(', ')} and ${names.at(-1)} side by side: OPR by part, records, head to head, alliance fit and shared events.`
			: 'Compare up to four FTC teams side by side: OPR by part, records, head to head, alliance fit and shared events.'
	);
	const matchup = $derived.by(() => {
		const numbers = view.teams.map((team) => team.number);
		return sidesFrom(numbers.slice(0, 2), numbers.slice(2));
	});
	const canonical = $derived(
		compareHref(view.teams.map((team) => team.number).toSorted((a, b) => a - b))
	);
</script>

<Seo {title} {description} path={canonical} noindex={!paired} />

<PageHeader
	title="Compare teams"
	meta="Up to four teams side by side: season OPR by part, records, how they did against each other and as partners, and how two or three of them would fit as an alliance."
/>

<TeamPicker teams={view.teams} suggestions={data.suggestions} />

{#if data.missing.length > 0}
	<p class="missing" role="status">
		No team found for {data.missing.join(', ')}.
	</p>
{/if}

{#if view.teams.length === 0}
	<EmptyState title="Pick two or more teams to compare.">
		Type team numbers above, or use the Compare button on any team page.
	</EmptyState>
{:else}
	<section class="panel" aria-labelledby="season-title">
		<h2 class="sec-title" id="season-title">This season</h2>
		<CompareTable teams={view.teams} rows={view.rows} />
		<p class="note">
			{#if view.source === 'scout'}
				Season ratings are not ready yet, so OPR is each team's best event from FTCScout.
			{:else}
				OPR is the points a team adds to its alliance's score. Hive, flower, garden, park and tips
				are parts of teleop.
			{/if}
			The best value in each row is underlined, ties included, unless every team shows the same. Record
			and ranks are from qualification matches.
		</p>
	</section>

	{#if view.teams.length >= 2}
		{#if view.fit}
			<section class="panel" aria-labelledby="fit-title">
				<h2 class="sec-title" id="fit-title">Alliance fit</h2>
				<AllianceFit fit={view.fit} />
			</section>
		{:else if view.teams.length > MAX_FIT}
			<p class="note">Remove a team to see how two or three of them would fit as an alliance.</p>
		{/if}

		<p class="simulate">
			<a href={simulateHref(matchup)}>
				{#if matchup.blue.length === 0}
					Simulate a match with {matchup.red.join(' + ')} as an alliance and pick their opponents
				{:else}
					Simulate {matchup.red.join(' + ')} vs {matchup.blue.join(' + ')}
				{/if}
			</a>
		</p>

		<section class="panel" aria-labelledby="h2h-title">
			<h2 class="sec-title" id="h2h-title">Head to head</h2>
			{#if view.history}
				<HeadToHead pairs={view.pairs} meetings={view.meetings} numbers={data.numbers} />
			{:else}
				<EmptyState title="Match history is still loading.">
					Reload in a minute to see the matches these teams played together and against each other,
					and how they would fit as an alliance.
				</EmptyState>
			{/if}
		</section>

		<section class="panel" aria-labelledby="shared-title">
			<h2 class="sec-title" id="shared-title">Shared events</h2>
			{#if view.shared.length === 0}
				<EmptyState title="These teams have not been entered in the same event this season." />
			{:else}
				<SharedEvents teams={view.teams} events={view.shared} />
				<p class="note">Rank and record are from qualification matches at that event.</p>
			{/if}
		</section>
	{/if}
{/if}

<style>
	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
		align-content: start;
		min-width: 0;
	}

	.simulate {
		font-size: 14px;
	}

	.missing {
		font-size: 14px;
		color: var(--text-2);
	}
</style>
