<script lang="ts">
	import { compareHref } from '#lib/components/compare/compare.ts';
	import RpChances from '#lib/components/event/RpChances.svelte';
	import PartTable from '#lib/components/simulate/PartTable.svelte';
	import SimulatePicker from '#lib/components/simulate/SimulatePicker.svelte';
	import {
		colorName,
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
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import PredictionCard from '#lib/ui/PredictionCard.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import type { PageProps } from './$types';

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
		return `${colorName(color)} ${integer(side.low)} to ${integer(side.high)}`;
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

<PageHeader
	title="Match simulator"
	meta="Put any two teams on each alliance and see how the match would likely go, from the same model as PitStop's match predictions."
/>

<SimulatePicker {sides} picked={data.picked} />

{#if data.missing.length > 0}
	<p class="missing" role="status">No team found for {data.missing.join(', ')}.</p>
{/if}

{#if simulation}
	<p class="headline">{headline(simulation)}</p>

	<div class="layout">
		<div class="panel wide">
			<div class="panel">
				<PredictionCard
					red={card(simulation.red)}
					blue={card(simulation.blue)}
					caption="Simulated match prediction"
				/>
				<p class="note">
					Likely score range, 8 matches in 10: {range('red')}, {range('blue')}.
				</p>
			</div>

			<section class="panel" aria-labelledby="parts-title">
				<h2 class="sec-title" id="parts-title">Part by part</h2>
				<PartTable red={simulation.red} blue={simulation.blue} />
				<p class="note">
					Expected points per match from each part. A team's share shows when it brings most of its
					alliance's points in that part. Tips are counts, not points.
				</p>
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
				<RpChances forecast={simulation.forecast} />
			</section>

			<p class="links">
				<a href={compareHref([...sides.red, ...sides.blue])}>Compare these four teams</a>
			</p>
		</div>
	</div>

	<p class="note">
		Each team's numbers are its current season rating, the same one match predictions use before an
		event starts. Chances are for one qualification match.
		{#if fresh.length > 0}
			No matches yet this season for {fresh.map((team) => team.number).join(', ')}, so
			{fresh.length === 1 ? 'its numbers start' : 'their numbers start'} from last season or a typical
			new team.
		{/if}
	</p>
{:else if full && !data.ready}
	<EmptyState title="Season ratings are still loading.">
		Reload in a minute to see the prediction for {matchup}.
	</EmptyState>
{:else}
	<EmptyState title="Pick two teams for each alliance.">
		Type a team number or name in each box. You can also start from a compare page, a match page or
		alliance selection.
		{#if suggestion}
			<br />
			Or try the top four teams this season:
			<a href={simulateHref(suggestion.sides)}>
				{suggestion.sides.red.map(teamText).join(' and ')} vs {suggestion.sides.blue
					.map(teamText)
					.join(' and ')}</a
			>.
		{/if}
	</EmptyState>
{/if}

<style>
	.missing {
		font-size: 14px;
		color: var(--text-2);
	}

	.headline {
		max-width: 68ch;
		margin: 0;
		font-size: 17px;
		font-weight: 500;
		color: var(--text);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 390px;
		gap: 28px;
		align-items: start;
	}

	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
		align-content: start;
		min-width: 0;
	}

	.panel.wide {
		gap: 22px;
	}

	.notes {
		display: grid;
		gap: 6px;
		margin: 0;
		padding-left: 18px;
		font-size: 14px;
		color: var(--text);
	}

	.links {
		font-size: 14px;
	}

	@media (max-width: 1120px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
