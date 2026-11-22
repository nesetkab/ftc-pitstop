<script lang="ts">
	import type { EventTiming, MatchForecast } from '#lib/analysis/types.ts';
	import { fixed } from '#lib/format/number.ts';
	import { pct } from '#lib/format/pct.ts';
	import { longDate, time } from '#lib/format/time.ts';
	import type { Match } from '#lib/types.ts';
	import Table from '#lib/ui/Table.svelte';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import { localDate } from './dates.ts';
	import { matchHref } from './matches.ts';

	interface Props {
		code: string;
		matches: Match[];
		timezone: string;
		forecasts?: Record<string, MatchForecast> | null;
		timing?: EventTiming | null;
		followed?: ReadonlySet<number>;
		byDay?: boolean;
	}

	let {
		code,
		matches,
		timezone,
		forecasts = null,
		timing = null,
		followed = new Set(),
		byDay = false
	}: Props = $props();

	const showExpected = $derived(
		timing !== null &&
			matches.some((match) => !match.result && timing?.matches[match.key]?.expectedStart)
	);
	const showForecast = $derived(
		forecasts !== null && matches.some((match) => forecasts?.[match.key])
	);
	const columns = $derived(5 + (showExpected ? 1 : 0) + (showForecast ? 2 : 0));

	const days = $derived.by(() => {
		const groups: { day: string; matches: Match[] }[] = [];
		for (const match of matches) {
			const day =
				byDay && match.scheduledTime !== null ? localDate(match.scheduledTime, timezone) : '';
			const last = groups.at(-1);
			if (last && last.day === day) last.matches.push(match);
			else groups.push({ day, matches: [match] });
		}
		return groups;
	});

	function expected(match: Match): number | null {
		if (match.result) return null;
		return timing?.matches[match.key]?.expectedStart ?? null;
	}

	function favorite(forecast: MatchForecast) {
		return forecast.red.win >= forecast.blue.win
			? { alliance: 'red' as const, label: 'Red', win: forecast.red.win }
			: { alliance: 'blue' as const, label: 'Blue', win: forecast.blue.win };
	}
</script>

<Table>
	<caption class="visually-hidden">Match schedule</caption>
	<thead>
		<tr>
			<th class="l" scope="col">Match</th>
			<th class="l opt" scope="col">Time</th>
			{#if showExpected}
				<th class="l opt" scope="col">Expected</th>
			{/if}
			<th class="l" scope="col">Red</th>
			<th class="l" scope="col">Blue</th>
			<th scope="col">Score</th>
			{#if showForecast}
				<th class="opt" scope="col">Predicted</th>
				<th scope="col">Win chance</th>
			{/if}
		</tr>
	</thead>
	{#each days as group, index (index)}
		<tbody>
			{#if group.day}
				<tr class="day">
					<th class="l" colspan={columns} scope="rowgroup">{longDate(group.day)}</th>
				</tr>
			{/if}
			{#each group.matches as match (match.key)}
				{@const forecast = forecasts?.[match.key]}
				{@const at = expected(match)}
				{@const when = at ?? match.scheduledTime}
				{@const result = match.result}
				<tr>
					<td class="l">
						<a class="label" href={matchHref(code, match)}>{match.label}</a>
						{#if when !== null}
							<span class="when">{time(when, timezone)}</span>
						{/if}
					</td>
					<td class="l muted opt">
						{match.scheduledTime === null ? '' : time(match.scheduledTime, timezone)}
					</td>
					{#if showExpected}
						<td class="l muted opt">{at === null ? '' : time(at, timezone)}</td>
					{/if}
					<td class="l">
						<span class="chips">
							{#each match.red as entry (entry.team)}
								<TeamChip number={entry.team} alliance="red" me={followed.has(entry.team)} />
							{/each}
						</span>
					</td>
					<td class="l">
						<span class="chips">
							{#each match.blue as entry (entry.team)}
								<TeamChip number={entry.team} alliance="blue" me={followed.has(entry.team)} />
							{/each}
						</span>
					</td>
					<td class="score">
						{#if result}
							<span class:won={result.winner === 'red'}>{result.red.total}</span><span class="dash"
								>–</span
							><span class:won={result.winner === 'blue'}>{result.blue.total}</span>
						{/if}
					</td>
					{#if showForecast}
						<td class="muted opt">
							{#if forecast}
								{fixed(forecast.red.score, 0)}–{fixed(forecast.blue.score, 0)}
							{/if}
						</td>
						<td>
							{#if forecast}
								{@const pick = favorite(forecast)}
								<span class={pick.alliance}>{pick.label}</span>
								{pct(pick.win)}
							{/if}
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	{/each}
</Table>

<style>
	.label {
		font-weight: 600;
	}

	.when {
		display: none;
		font-size: 12.5px;
		color: var(--text-2);
	}

	.chips {
		display: inline-flex;
		gap: 4px;
	}

	@media (max-width: 600px) {
		.when {
			display: block;
		}

		.chips {
			flex-direction: column;
			align-items: flex-start;
		}
	}

	.score span {
		color: var(--text-2);
	}

	.score .dash {
		padding-inline: 1px;
		color: var(--text-3);
	}

	.score .won {
		color: var(--text);
		font-weight: 600;
	}

	.red {
		color: var(--red);
	}

	.blue {
		color: var(--blue);
	}

	tr.day th {
		padding-top: 18px;
		color: var(--text-2);
		font-size: 13px;
		text-align: left;
	}

	tbody:first-of-type tr.day th {
		padding-top: 10px;
	}
</style>
