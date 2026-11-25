<script lang="ts">
	import AllianceFit from '#lib/components/compare/AllianceFit.svelte';
	import CompareSections from '#lib/components/compare/CompareSections.svelte';
	import CompareTable from '#lib/components/compare/CompareTable.svelte';
	import HeadToHead from '#lib/components/compare/HeadToHead.svelte';
	import SharedEvents from '#lib/components/compare/SharedEvents.svelte';
	import TeamPicker from '#lib/components/compare/TeamPicker.svelte';
	import { compareHref } from '#lib/components/compare/compare.ts';
	import { MAX_FIT } from '#lib/components/compare/fit.ts';
	import { siteTitle } from '#lib/seo.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { missingTeams } from '#lib/ui/not-found.ts';
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
			? `Compare FTC teams ${names.slice(0, -1).join(', ')} and ${names.at(-1)} side by side: aOPR by part, records, head to head, alliance fit and shared events.`
			: 'Compare up to four FTC teams side by side: aOPR by part, records, head to head, alliance fit and shared events.'
	);
	const width = $derived(300 + 190 * Math.max(2, view.teams.length));
	const canonical = $derived(
		compareHref(view.teams.map((team) => team.number).toSorted((a, b) => a - b))
	);
</script>

<Seo {title} {description} path={canonical} noindex={!paired} />

<CompareSections teams={data.numbers} />

<PageHeader title="Compare teams" meta="Up to four teams side by side." />

<TeamPicker teams={view.teams} suggestions={data.suggestions} />

{#if data.missing.length > 0}
	<p class="missing" role="status">
		{missingTeams(data.missing)}
	</p>
{/if}

{#if view.teams.length === 0}
	<EmptyState title="Pick two or more teams to compare." />
{:else}
	<section class="panel" style:max-width="{width}px" aria-labelledby="season-title">
		<h2 class="sec-title" id="season-title">This season</h2>
		<CompareTable teams={view.teams} rows={view.rows} />
		{#if view.source === 'scout'}
			<p class="note">
				Season aOPR isn't ready yet, so OPR here is each team's best event on FTCScout.
			</p>
		{/if}
	</section>

	{#if view.teams.length >= 2}
		{#if view.fit}
			<section class="panel" style:max-width="{width}px" aria-labelledby="fit-title">
				<h2 class="sec-title" id="fit-title">Alliance fit</h2>
				<AllianceFit fit={view.fit} />
			</section>
		{:else if view.teams.length > MAX_FIT}
			<p class="note">Alliance fit shows for two or three teams.</p>
		{/if}

		<section class="panel" style:max-width="{width}px" aria-labelledby="h2h-title">
			<h2 class="sec-title" id="h2h-title">Head to head</h2>
			{#if view.history}
				<HeadToHead pairs={view.pairs} meetings={view.meetings} numbers={data.numbers} />
			{:else}
				<EmptyState title="Match history is still loading. Try again in a minute." />
			{/if}
		</section>

		<section class="panel" style:max-width="{width}px" aria-labelledby="shared-title">
			<h2 class="sec-title" id="shared-title">Shared events</h2>
			{#if view.shared.length === 0}
				<EmptyState title="These teams have not been at the same event this season." />
			{:else}
				<SharedEvents teams={view.teams} events={view.shared} />
			{/if}
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

	.missing {
		font-size: 14px;
		color: var(--text-2);
	}
</style>
