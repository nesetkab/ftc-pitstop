<script lang="ts">
	import Term from '#lib/ui/Term.svelte';
	import { matchHref } from '#lib/components/event/matches.ts';
	import { MISSING, record } from '#lib/format/index.ts';
	import { PART_LABELS } from '#lib/game/biobuzz.ts';
	import Score from '#lib/ui/Score.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamChip from '#lib/ui/TeamChip.svelte';
	import { shortRange } from '#lib/format/time.ts';
	import type { MatchOutcome, TeamMatchEvent, TeamMatchParts } from './matches.ts';

	interface Props {
		events: TeamMatchEvent[];
		team: number;
	}

	let { events, team }: Props = $props();

	const parts: { key: keyof TeamMatchParts; label: string }[] = [
		{ key: 'auto', label: PART_LABELS.auto },
		{ key: 'hive', label: PART_LABELS.hive },
		{ key: 'flower', label: PART_LABELS.flower },
		{ key: 'garden', label: PART_LABELS.garden },
		{ key: 'park', label: PART_LABELS.park }
	];

	const OUTCOME: Record<MatchOutcome, string> = { win: 'W', loss: 'L', tie: 'T' };

	let opened = $state<string[]>([]);

	function toggle(code: string, event: Event) {
		const open = (event.currentTarget as HTMLDetailsElement).open;
		if (open && !opened.includes(code)) opened = [...opened, code];
	}

	function count(entry: TeamMatchEvent): string {
		const played = entry.rows.filter((row) => row.outcome !== null).length;
		return played === 1 ? '1 match' : `${played} matches`;
	}
</script>

<div class="events">
	{#each events as entry, index (entry.code)}
		<details open={index === 0} ontoggle={(event) => toggle(entry.code, event)}>
			<summary>
				<span class="name">{entry.name}</span>
				<span class="meta">
					{shortRange(entry.start, entry.end)}, {count(entry)},
					{record(entry.record.wins, entry.record.losses, entry.record.ties)}
				</span>
			</summary>
			{#if index === 0 || opened.includes(entry.code)}
				<Table>
					<caption class="visually-hidden">Matches for {team} at {entry.name}</caption>
					<thead>
						<tr>
							<th class="l" scope="col">Match</th>
							<th class="l" scope="col">Alliance and opponents</th>
							<th scope="col">Score</th>
							{#each parts as part (part.key)}
								<th class="opt" scope="col"><Term label={part.label} /></th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each entry.rows as row (row.key)}
							{@const other = row.alliance === 'red' ? 'blue' : 'red'}
							<tr>
								<td class="l">
									<a class="match" href={matchHref(entry.code, row)}>{row.label}</a>
									{#if row.surrogate}<span class="faint small">Surrogate</span>{/if}
								</td>
								<td class="l wrap">
									<span class="teams">
										<span class="side">
											<TeamChip number={team} alliance={row.alliance} />
											{#each row.partners as partner (partner)}
												<TeamChip
													number={partner}
													alliance={row.alliance}
													href="/teams/{partner}"
												/>
											{/each}
										</span>
										<span class="side">
											<span class="faint small">vs</span>
											{#each row.opponents as opponent (opponent)}
												<TeamChip number={opponent} alliance={other} href="/teams/{opponent}" />
											{/each}
										</span>
									</span>
								</td>
								<td>
									{#if row.outcome && row.score !== null && row.against !== null}
										<span class={['outcome', row.outcome]}>{OUTCOME[row.outcome]}</span>
										<Score left={row.score} right={row.against} winner="left" />
									{:else}
										<span class="faint">Not played</span>
									{/if}
								</td>
								{#each parts as part (part.key)}
									<td class="opt">{row.parts ? row.parts[part.key] : MISSING}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</Table>
			{/if}
		</details>
	{/each}
</div>
<p class="note">
	Scores include points from fouls. The points columns are for this team's alliance. Hive, flower,
	garden and park are teleop points.
</p>

<style>
	.events {
		display: grid;
		gap: 4px;
	}

	details {
		border-bottom: 1px solid var(--line);
	}

	details[open] {
		padding-bottom: 12px;
	}

	summary {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
		align-items: baseline;
		padding: 10px 0;
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary::before {
		content: '';
		align-self: center;
		width: 6px;
		height: 6px;
		margin: 0 2px 0 2px;
		border-right: 1.5px solid var(--text-3);
		border-bottom: 1.5px solid var(--text-3);
		transform: rotate(-45deg);
		transition: transform 0.15s;
	}

	details[open] > summary::before {
		transform: rotate(45deg);
	}

	summary:hover .name {
		text-decoration: underline;
	}

	.name {
		font-weight: 600;
	}

	.meta {
		font-size: 13px;
		color: var(--text-2);
		font-variant-numeric: tabular-nums;
	}

	.match {
		font-weight: 600;
	}

	.small {
		margin-left: 4px;
		font-size: 12.5px;
	}

	.teams {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
	}

	.side {
		display: inline-flex;
		gap: 4px;
		align-items: baseline;
	}

	.side .small {
		margin: 0 2px 0 0;
	}

	.outcome {
		display: inline-block;
		width: 1.2em;
		margin-right: 4px;
		font-weight: 600;
		text-align: center;
	}

	.outcome.loss,
	.outcome.tie {
		color: var(--text-3);
	}
</style>
