<script lang="ts">
	import { fixed, longDate, pct } from '#lib/format/index.ts';
	import Lede from '#lib/ui/Lede.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import { seasonRange, type AccuracyReport, type Metric } from './accuracy.ts';
	import QueueEstimates from './QueueEstimates.svelte';
	import RpCalibration from './RpCalibration.svelte';
	import SeasonResults from './SeasonResults.svelte';
	import WinCalibration from './WinCalibration.svelte';

	interface Props {
		report: AccuracyReport;
		sample?: boolean;
	}

	let { report, sample = false }: Props = $props();

	const METRICS = [
		{ value: 'accuracy', label: 'Winner accuracy' },
		{ value: 'brier', label: 'Brier score' },
		{ value: 'mae', label: 'Score error' }
	] as const;

	let metric = $state<Metric>('accuracy');

	const DESCRIPTIONS: Record<string, string> = {
		'robot-opr':
			'PitStop predicts each match from aOPR, its estimate of the points each team adds.',
		'opr-map': 'PitStop predicts each match from OPR, its estimate of the points each team adds.'
	};

	const description = $derived(
		DESCRIPTIONS[report.chosen.id] ?? `PitStop predicts each match with ${report.chosen.label}.`
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
				lead="PitStop picked the winner in {pct(
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

<section aria-labelledby="seasons-title">
	<div class="fit">
		<div class="head">
			<h2 class="sec-title" id="seasons-title">Results by season</h2>
			<Segmented
				label="Measure"
				options={METRICS}
				value={metric}
				onselect={(next) => (metric = next)}
			/>
		</div>
		<SeasonResults
			seasons={report.seasons}
			models={report.models}
			chosen={report.chosen.id}
			{metric}
		/>
	</div>
	<dl class="terms">
		<div>
			<dt>Winner accuracy</dt>
			<dd>How often the alliance with the higher win chance won.</dd>
		</div>
		<div>
			<dt>Brier score</dt>
			<dd>
				How far the win chances were from the results. Lower is better, and always guessing 50%
				scores 0.250.
			</dd>
		</div>
		<div>
			<dt>Score error</dt>
			<dd>
				How many points the predicted score of one alliance was off, on average. Lower is better.
			</dd>
		</div>
	</dl>
</section>

{#if hasCalibration}
	<section aria-labelledby="calibration-title">
		<h2 class="sec-title" id="calibration-title">Win chance calibration</h2>
		<p>
			When red was given a 70% chance, red should have won about 70% of the time. Points on the
			dashed line mean the chances matched the results.
		</p>
		<WinCalibration {report} />
	</section>
{/if}

{#if report.rp}
	<section aria-labelledby="rp-title">
		<h2 class="sec-title" id="rp-title">Ranking point chances</h2>
		<p>
			How well the ranking point chances matched {report.rp.season} qualification results. They were fitted
			on these same matches, so this is not a held-out test.
		</p>
		<RpCalibration rp={report.rp} />
	</section>
{/if}

{#if report.schedule}
	<section aria-labelledby="queue-title">
		<h2 class="sec-title" id="queue-title">Queue time estimates</h2>
		<p>
			How many minutes the start time estimates were off, by how many matches ahead they looked.
		</p>
		<QueueEstimates schedule={report.schedule} />
	</section>
{/if}

<section aria-labelledby="method-title">
	<h2 class="sec-title" id="method-title">Method</h2>
	<p>{description} <a href="/about">How the numbers work</a>.</p>
	<p>
		Every match was predicted using only the matches played before it. The model was tuned on
		{seasonRange(report.method.train)}, chosen on {seasonRange(report.method.validation)}, and never
		saw {seasonRange(report.method.test)} before this test.
	</p>
</section>

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

	.fit {
		display: grid;
		gap: 12px;
		width: fit-content;
		max-width: 100%;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 20px;
		align-items: center;
		justify-content: space-between;
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
