<script lang="ts">
	import { record, shortDate } from '#lib/format/index.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Table from '#lib/ui/Table.svelte';
	import type { Meeting, PairRecord, Tally } from './compare.ts';

	interface Props {
		pairs: PairRecord[];
		meetings: Meeting[];
		numbers: number[];
	}

	let { pairs, meetings, numbers }: Props = $props();

	const count = (tally: Tally) => tally.wins + tally.losses + tally.ties;

	function against(pair: PairRecord): string {
		const games = count(pair.against);
		if (games === 0) return 'Never on opposite alliances';
		const ties = pair.against.ties > 0 ? `, ${pair.against.ties} tied` : '';
		return `${pair.a} won ${pair.against.wins}, ${pair.b} won ${pair.against.losses}${ties}`;
	}

	function together(pair: PairRecord): string {
		const games = count(pair.together);
		if (games === 0) return 'Never on the same alliance';
		const { wins, losses, ties } = pair.together;
		return `${record(wins, losses, ties)} in ${games} ${games === 1 ? 'match' : 'matches'}`;
	}
</script>

<Table>
	<caption class="visually-hidden">Results between each pair of teams</caption>
	<thead>
		<tr>
			<th class="l pin" scope="col">Teams</th>
			<th class="l" scope="col">Against each other</th>
			<th class="l" scope="col">As partners</th>
		</tr>
	</thead>
	<tbody>
		{#each pairs as pair (`${pair.a}-${pair.b}`)}
			<tr>
				<th class="l pair pin" scope="row">{pair.a} and {pair.b}</th>
				<td class="l wrap" class:dim={count(pair.against) === 0}>{against(pair)}</td>
				<td class="l wrap" class:dim={count(pair.together) === 0}>
					{together(pair)}
					{#if pair.best}
						<span class="best"
							>best score {pair.best.score} in
							<a href="/events/{pair.best.code}/matches/{pair.best.key}">{pair.best.label}</a></span
						>
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</Table>

{#if meetings.length === 0}
	<EmptyState title="These teams have not played in the same match this season." />
{:else}
	<Table>
		<caption class="visually-hidden">Matches with two or more of these teams</caption>
		<thead>
			<tr>
				<th class="l opt" scope="col">Event</th>
				<th class="l" scope="col">Match</th>
				<th class="l" scope="col">Red</th>
				<th class="l" scope="col">Blue</th>
				<th scope="col">Score</th>
			</tr>
		</thead>
		<tbody>
			{#each meetings as meeting (`${meeting.code}:${meeting.key}`)}
				<tr>
					<td class="l event opt">
						<a href="/events/{meeting.code}">{meeting.event}</a>
						<span class="date">{shortDate(meeting.start)}</span>
					</td>
					<td class="l">
						<a class="match" href="/events/{meeting.code}/matches/{meeting.key}">{meeting.label}</a>
						<span class="phone">{shortDate(meeting.start)} · {meeting.event}</span>
					</td>
					{#each ['red', 'blue'] as const as color (color)}
						<td class="l">
							<span class="chips">
								{#each meeting[color] as team (team)}
									<a
										class={['chip', color, { other: !numbers.includes(team) }]}
										href="/teams/{team}">{team}</a
									>
								{/each}
							</span>
						</td>
					{/each}
					<td class="score">
						<span class:won={meeting.winner === 'red'}>{meeting.redScore}</span>
						<span class="dash">–</span>
						<span class:won={meeting.winner === 'blue'}>{meeting.blueScore}</span>
					</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}

<style>
	.pin {
		position: sticky;
		left: 0;
		z-index: 1;
		background: var(--bg);
	}

	td.wrap {
		vertical-align: top;
	}

	.best {
		display: block;
		font-size: 12.5px;
		color: var(--text-3);
	}

	th.pair {
		vertical-align: top;
		padding: 9px 10px;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.event {
		max-width: 280px;
	}

	.event a {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.date {
		font-size: 12.5px;
		color: var(--text-3);
	}

	.match {
		font-weight: 600;
	}

	.phone {
		display: none;
	}

	.chips {
		display: inline-flex;
		gap: 4px;
	}

	.chip {
		padding: 2px 7px;
		border-radius: var(--radius-chip);
		font-weight: 600;
	}

	.chip.red {
		background: var(--red-wash);
	}

	.chip.blue {
		background: var(--blue-wash);
	}

	.chip.other {
		background: transparent;
		color: var(--text-2);
		font-weight: 400;
	}

	.score {
		color: var(--text-2);
	}

	.won {
		color: var(--text);
		font-weight: 600;
	}

	.dash {
		margin-inline: 2px;
	}

	@media (max-width: 600px) {
		th.pair {
			min-width: 76px;
			padding-inline: 6px;
			white-space: normal;
		}

		.pin {
			box-shadow: inset -1px 0 var(--line);
		}

		.phone {
			display: block;
			max-width: 34vw;
			overflow: hidden;
			font-size: 12.5px;
			color: var(--text-3);
			text-overflow: ellipsis;
		}

		.chips {
			flex-direction: column;
			align-items: flex-start;
		}

		.chip {
			padding-inline: 5px;
		}
	}
</style>
