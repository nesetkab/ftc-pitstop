<script lang="ts">
	import type { EventAnalysis } from '#lib/analysis/types.ts';
	import { time } from '#lib/format/time.ts';
	import type { EventBundle, Match } from '#lib/types.ts';
	import Button from '#lib/ui/Button.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import PredictionCard from '#lib/ui/PredictionCard.svelte';
	import AveragePoints from './AveragePoints.svelte';
	import { pointAverages } from './averages.ts';
	import { isMultiDay, weekday } from './dates.ts';
	import MatchBreakdown from './MatchBreakdown.svelte';
	import MatchScoreCard from './MatchScoreCard.svelte';
	import MatchTeams from './MatchTeams.svelte';
	import { hasTeam, matchHref, neighbors, teamNumbers, titleOf } from './matches.ts';
	import RpChances from './RpChances.svelte';

	interface Props {
		bundle: Pick<EventBundle, 'event' | 'teams' | 'matches' | 'rankings'>;
		match: Match;
		analysis?: Pick<EventAnalysis, 'forecasts' | 'ratings' | 'timing'> | null;
		followed?: ReadonlySet<number>;
	}

	let { bundle, match, analysis = null, followed = new Set() }: Props = $props();

	const code = $derived(bundle.event.code);
	const zone = $derived(bundle.event.timezone);
	const forecast = $derived(analysis?.forecasts[match.key] ?? null);
	const expected = $derived(
		match.result ? null : (analysis?.timing.matches[match.key]?.expectedStart ?? null)
	);
	const names = $derived(new Map(bundle.teams.map((team) => [team.number, team.name])));
	const around = $derived(neighbors(bundle.matches, match.key));
	const averages = $derived(pointAverages(bundle.matches));
	const multiDay = $derived(isMultiDay(bundle.event));
	const mine = $derived([...followed].find((team) => hasTeam(match, team)));

	function at(value: number) {
		const clock = time(value, zone);
		return multiDay ? `${weekday(value, zone)} at ${clock}` : clock;
	}

	const meta = $derived.by(() => {
		const parts: string[] = [];
		if (match.result) {
			const played = match.actualTime;
			parts.push(played === null ? 'Played.' : `Played ${multiDay ? '' : 'at '}${at(played)}.`);
			if (match.scheduledTime !== null) parts.push(`Scheduled for ${at(match.scheduledTime)}.`);
		} else {
			if (match.scheduledTime !== null) parts.push(`Scheduled for ${at(match.scheduledTime)}.`);
			if (expected !== null) parts.push(`Expected around ${at(expected)}.`);
			parts.push('Not played yet.');
		}
		return parts.join(' ');
	});

	function side(color: 'red' | 'blue') {
		return {
			teams: teamNumbers(match, color).map((number) => ({ number, name: names.get(number) })),
			win: forecast?.[color].win ?? null,
			score: forecast?.[color].score ?? null
		};
	}
</script>

<PageHeader title={titleOf(match)} {meta}>
	{#snippet actions()}
		{#if around.previous}
			<Button
				variant="secondary"
				href={matchHref(code, around.previous)}
				aria-label="Previous match, {around.previous.label}"
			>
				← {around.previous.label}
			</Button>
		{/if}
		{#if around.next}
			<Button
				variant="secondary"
				href={matchHref(code, around.next)}
				aria-label="Next match, {around.next.label}"
			>
				{around.next.label} →
			</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="layout">
	<div class="panel wide">
		{#if !match.result && forecast}
			<PredictionCard
				red={side('red')}
				blue={side('blue')}
				me={mine}
				caption="{match.label} prediction"
			/>
		{:else}
			<MatchScoreCard {match} teams={bundle.teams} {forecast} {followed} />
		{/if}

		{#if match.result}
			<div class="panel">
				<h2 class="sec-title">Score breakdown</h2>
				<MatchBreakdown result={match.result} />
			</div>
		{/if}

		<div class="panel">
			<h2 class="sec-title">Teams</h2>
			<MatchTeams
				{match}
				teams={bundle.teams}
				rankings={bundle.rankings}
				ratings={analysis?.ratings ?? null}
				{followed}
			/>
		</div>
	</div>

	<div class="panel wide">
		{#if match.level === 'qual' && (forecast || match.result)}
			<div class="panel">
				<h2 class="sec-title">{match.result ? 'Ranking points' : 'Ranking point chances'}</h2>
				<RpChances {forecast} result={match.result} />
			</div>
		{/if}
		{#if averages}
			<div class="panel">
				<h2 class="sec-title">Average points per alliance at this event</h2>
				<AveragePoints {averages} />
			</div>
		{/if}
	</div>
</div>

<style>
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

	h2.sec-title {
		font-size: 15px;
		line-height: 1.4;
		letter-spacing: 0;
	}

	@media (max-width: 1120px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
