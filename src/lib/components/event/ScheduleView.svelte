<script lang="ts">
	import type { EventTiming, MatchForecast } from '#lib/analysis/types.ts';
	import type { Match, Team } from '#lib/types.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import ScheduleTable from './ScheduleTable.svelte';
	import { hasTeam } from './matches.ts';

	interface Props {
		code: string;
		matches: Match[];
		teams: Team[];
		timezone: string;
		forecasts?: Record<string, MatchForecast> | null;
		timing?: EventTiming | null;
		followed?: ReadonlySet<number>;
		byDay?: boolean;
		team?: number | null;
		onteam?: (team: number | null) => void;
	}

	let {
		code,
		matches,
		teams,
		timezone,
		forecasts = null,
		timing = null,
		followed = new Set(),
		byDay = false,
		team = $bindable(null),
		onteam
	}: Props = $props();

	const id = $props.id();

	const options = $derived(
		[...teams].sort(
			(a, b) =>
				Number(followed.has(b.number)) - Number(followed.has(a.number)) || a.number - b.number
		)
	);
	const shown = $derived.by(() => {
		const selected = team;
		return selected === null ? matches : matches.filter((match) => hasTeam(match, selected));
	});
	const sections = $derived(
		[
			{ title: 'Qualification matches', list: shown.filter((match) => match.level === 'qual') },
			{ title: 'Playoff matches', list: shown.filter((match) => match.level === 'playoff') }
		].filter((section) => section.list.length > 0)
	);
	const chosen = $derived(teams.find((entry) => entry.number === team) ?? null);

	function choose(event: Event & { currentTarget: HTMLSelectElement }) {
		const value = Number(event.currentTarget.value);
		team = value > 0 ? value : null;
		onteam?.(team);
	}
</script>

<div class="filter">
	<label for="{id}-team">Team</label>
	<select id="{id}-team" value={team === null ? '' : String(team)} onchange={choose}>
		<option value="">All teams</option>
		{#each options as entry (entry.number)}
			<option value={String(entry.number)}>{entry.number} {entry.name}</option>
		{/each}
	</select>
	{#if team !== null}
		<span class="muted">{shown.length} {shown.length === 1 ? 'match' : 'matches'}</span>
	{/if}
</div>

{#if sections.length === 0}
	<EmptyState
		title={chosen ? `${chosen.number} has no matches in the schedule.` : 'No matches yet.'}
	>
		{chosen ? 'Pick another team, or All teams.' : 'Matches show here once the schedule is posted.'}
	</EmptyState>
{:else}
	{#each sections as section (section.title)}
		<div class="section">
			{#if sections.length > 1 || section.list[0].level === 'playoff'}
				<h2 class="sec-title">{section.title}</h2>
			{/if}
			<ScheduleTable
				{code}
				matches={section.list}
				{timezone}
				{forecasts}
				{timing}
				{followed}
				{byDay}
			/>
		</div>
	{/each}
{/if}

<style>
	.filter {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		font-size: 14px;
	}

	label {
		color: var(--text-2);
	}

	select {
		min-width: 0;
		max-width: 100%;
	}

	.section {
		display: grid;
		gap: var(--space-title);
		min-width: 0;
	}
</style>
