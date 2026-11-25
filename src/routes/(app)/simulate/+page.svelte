<script lang="ts">
	import CompareSections from '#lib/components/compare/CompareSections.svelte';
	import RpChances from '#lib/components/event/RpChances.svelte';
	import PartTable from '#lib/components/simulate/PartTable.svelte';
	import SimulatePicker from '#lib/components/simulate/SimulatePicker.svelte';
	import {
		COLORS,
		headline,
		isFull,
		simulateHref,
		type Color,
		type SimSide
	} from '#lib/components/simulate/simulate.ts';
	import { integer } from '#lib/format/index.ts';
	import { siteTitle } from '#lib/seo.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { missingTeams } from '#lib/ui/not-found.ts';
	import Lede from '#lib/ui/Lede.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import PredictionCard from '#lib/ui/PredictionCard.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import type { PageProps } from './$types';
	import Legend from '#lib/ui/Legend.svelte';

	let { data }: PageProps = $props();

	const simulation = $derived(data.simulation);
	const sides = $derived(data.sides);
	const full = $derived(isFull(sides));
	const matchup = $derived(`${sides.red.join(' & ')} vs ${sides.blue.join(' & ')}`);
	const title = $derived(
		full ? siteTitle(`${matchup}, simulated FTC match`) : siteTitle('FTC match simulator')
	);
	const description = $derived(
		full
			? `Predicted score, win chance and ranking point chances if FTC teams ${sides.red.join(' and ')} played ${sides.blue.join(' and ')}.`
			: 'Pick any four FTC teams and see the predicted score, win chance and ranking point chances for a match between them.'
	);
	const fresh = $derived(
		simulation
			? COLORS.flatMap((color) => simulation[color].teams.filter((team) => !team.rated))
			: []
	);
	const suggestion = $derived(data.suggestion);

	function card(side: SimSide) {
		return {
			teams: side.teams.map((team) => ({ number: team.number, name: team.name })),
			win: simulation?.forecast[side.color].win ?? null,
			score: side.score
		};
	}

	function range(color: Color): string {
		const side = simulation![color];
		return `${integer(side.low)} to ${integer(side.high)}`;
	}

	function teamText(number: number): string {
		const name = suggestion?.names[number];
		return name ? `${number} ${name}` : String(number);
	}
</script>

<Seo
	{title}
	{description}
	path={simulateHref(sides)}
	noindex={COLORS.some((c) => sides[c].length > 0)}
/>

<CompareSections teams={[...sides.red, ...sides.blue]} />

<PageHeader
	title="Match simulator"
	meta="See how a match between any four teams would likely go."
/>

<SimulatePicker {sides} picked={data.picked} />

{#if data.missing.length > 0}
	<p class="missing" role="status">{missingTeams(data.missing)}</p>
{/if}

{#if simulation}
	{@const verdict = headline(simulation)}
	<Lede lead={verdict.lead} rest={verdict.rest} aria-label="Verdict" />

	<div class="layout">
		<div class="panel wide">
			<div class="panel">
				<PredictionCard
					red={card(simulation.red)}
					blue={card(simulation.blue)}
					caption="Simulated match prediction"
				/>
				<p class="note">
					In 8 of 10 matches, Red scores {range('red')} and Blue scores {range('blue')}.
				</p>
			</div>

			<section class="panel" aria-labelledby="parts-title">
				<h2 class="sec-title" id="parts-title">Part by part</h2>
				<PartTable red={simulation.red} blue={simulation.blue} />
			</section>
		</div>

		<div class="panel wide">
			{#if simulation.notes.length > 0}
				<section class="panel" aria-labelledby="decided-title">
					<h2 class="sec-title" id="decided-title">Where it will be decided</h2>
					<ul class="notes">
						{#each simulation.notes as note (note)}
							<li>{note}</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="panel" aria-labelledby="rp-title">
				<h2 class="sec-title" id="rp-title">Ranking point chances</h2>
				<RpChances forecast={simulation.forecast} measure="Ranking point" />
			</section>
		</div>
	</div>

	{#if fresh.length > 0}
		<p class="note">
			No matches yet this season for {fresh.map((team) => team.number).join(', ')}, so
			{fresh.length === 1 ? 'its numbers start' : 'their numbers start'} from last season or a typical
			new team.
		</p>
	{/if}
	<Legend>
		When one team brings most of its alliance's points in a part, its share shows under the value.
		Tips are counts, not points. Chances are for a single qualification match.
	</Legend>
{:else if full && !data.ready}
	<EmptyState title="Season ratings are still loading. Try again in a minute." />
{:else if suggestion}
	<EmptyState title="Pick two teams for each alliance.">
		Try the top four teams this season:
		<a href={simulateHref(suggestion.sides)}>
			{suggestion.sides.red.map(teamText).join(' and ')} vs {suggestion.sides.blue
				.map(teamText)
				.join(' and ')}</a
		>.
	</EmptyState>
{:else}
	<EmptyState title="Pick two teams for each alliance." />
{/if}

<style>
	.missing {
		font-size: 14px;
		color: var(--text-2);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 390px;
		gap: var(--space-columns);
		align-items: start;
	}

	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-title);
		align-content: start;
		min-width: 0;
	}

	.panel.wide {
		gap: var(--space-stack);
	}

	.notes {
		display: grid;
		gap: 6px;
		margin: 0;
		padding-left: 18px;
		font-size: 14px;
		color: var(--text);
	}

	@media (max-width: 1120px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
