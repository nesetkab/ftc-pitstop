<script lang="ts">
	import { fixed, longDate, pct } from '#lib/format/index.ts';
	import Lede from '#lib/ui/Lede.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { seasonRange, type AccuracyReport } from './accuracy.ts';
	import QueueEstimates from './QueueEstimates.svelte';
	import RpCalibration from './RpCalibration.svelte';
	import SeasonResults from './SeasonResults.svelte';
	import WinCalibration from './WinCalibration.svelte';

	interface Props {
		report: AccuracyReport;
		sample?: boolean;
	}

	let { report, sample = false }: Props = $props();

	const DESCRIPTIONS: Record<string, string> = {
		'robot-opr':
			"PitStop predicts matches from aOPR, adjusted OPR, the points a team adds to its alliance's score, without penalty points. Points FIRST records per robot, like leaving and parking, go straight to that team, and the rest is solved from alliance scores. Each team's earlier events and last three seasons give a starting estimate that the matches at the current event soon replace. No team is rated below zero, and an alliance with one much stronger team is expected to score a little more. The win chance comes from the predicted score gap.",
		'opr-map':
			"PitStop predicts matches from OPR, the points a team adds to its alliance's score. OPR is solved from the scores of earlier matches, without penalty points. Each team's earlier events and last season give a starting estimate that the matches at the current event soon replace. The win chance comes from the predicted score gap."
	};

	const description = $derived(
		DESCRIPTIONS[report.chosen.id] ??
			`PitStop predicts matches with this model: ${report.chosen.label}.`
	);
	const headline = $derived(
		[...report.seasons]
			.filter((season) => season.split === 'test' && season.models[report.chosen.id])
			.sort((a, b) => b.season - a.season)[0]
	);
	const headlineMetrics = $derived(headline ? headline.models[report.chosen.id] : null);
	const hasCalibration = $derived(
		Boolean(report.calibration?.validation?.length || report.calibration?.test?.length)
	);
</script>

<PageHeader title="Prediction accuracy">
	{#snippet lede()}
		{#if headline && headlineMetrics}
			<Lede
				lead="Picked the winner in {pct(
					headlineMetrics.accuracy
				)} of {headline.season} matches it was not tuned on."
				rest="Scores were off by {fixed(headlineMetrics.mae)} points per alliance on average."
				aria-label="Summary"
			/>
		{/if}
	{/snippet}
</PageHeader>

{#if sample}
	<p class="sample">Sample numbers. The full backtest is not part of this build.</p>
{/if}

<section aria-labelledby="method-title">
	<h2 class="sec-title" id="method-title">Method</h2>
	<p>{description}</p>
	<p>
		Every match below was predicted using only matches played before it. Parameters were set on
		{seasonRange(report.method.train)}, the model was chosen on
		{seasonRange(report.method.validation)}, and {seasonRange(report.method.test)} was not used for either.
		Matches with impossible scores are left out.
	</p>
</section>

<section aria-labelledby="seasons-title">
	<h2 class="sec-title" id="seasons-title">Results by season</h2>
	<SeasonResults seasons={report.seasons} models={report.models} chosen={report.chosen.id} />
	<dl class="terms">
		<div>
			<dt>Winner accuracy</dt>
			<dd>How often the alliance with the higher win chance won. Ties are left out.</dd>
		</div>
		<div>
			<dt>Brier score</dt>
			<dd>
				The average squared gap between the win chance and the result, where a win is 1, a loss is 0
				and a tie is 0.5. Lower is better. Always predicting 50% scores 0.250.
			</dd>
		</div>
		<div>
			<dt>Log loss</dt>
			<dd>
				Like the Brier score, but it punishes confident misses more. Lower is better. Always
				predicting 50% scores 0.693.
			</dd>
		</div>
		<div>
			<dt>Score error</dt>
			<dd>
				The average gap in points between the predicted and real score of one alliance, without
				penalty points. Lower is better.
			</dd>
		</div>
	</dl>
</section>

{#if hasCalibration}
	<section aria-labelledby="calibration-title">
		<h2 class="sec-title" id="calibration-title">Win chance calibration</h2>
		<p>
			Matches are grouped by the predicted chance that red wins. Each point shows how often red won
			in that group, for the model used on this site. Points on the dashed line mean the predicted
			chance matched the result. Larger points have more matches.
		</p>
		<WinCalibration {report} />
	</section>
{/if}

{#if report.rp}
	<section aria-labelledby="rp-title">
		<h2 class="sec-title" id="rp-title">Ranking point chances</h2>
		<p>
			Chances that an alliance earns each ranking point, checked against {report.rp.season} qualification
			results. These chances were fitted on the same matches, so this shows how well they fit, not a held-out
			test.
		</p>
		<RpCalibration rp={report.rp} />
	</section>
{/if}

{#if report.schedule}
	<section aria-labelledby="queue-title">
		<h2 class="sec-title" id="queue-title">Queue time estimates</h2>
		<p>
			Each estimate is made when a match starts and predicts when a later match will start. The
			columns show how many matches later that match is.
		</p>
		<QueueEstimates schedule={report.schedule} />
	</section>
{/if}

<p class="note">Results generated {longDate(report.generatedAt, 'UTC')}.</p>

<style>
	section {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 12px;
		max-width: 920px;
	}

	p {
		max-width: 720px;
		color: var(--text-2);
	}

	.sample {
		padding: 10px 14px;
		border-radius: var(--radius-control);
		background: var(--surface);
		color: var(--text);
		font-size: 14px;
	}

	.terms {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px 32px;
		margin: 8px 0 0;
	}

	.terms div {
		display: grid;
		gap: 2px;
	}

	dt {
		font-size: 14px;
		font-weight: 600;
	}

	dd {
		font-size: 14px;
		color: var(--text-2);
	}

	@media (max-width: 760px) {
		.terms {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
