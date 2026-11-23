<script lang="ts">
	import '#lib/ui/score-table.css';
	import type { MatchForecast } from '#lib/analysis/types.ts';
	import { fixed } from '#lib/format/number.ts';
	import { pct } from '#lib/format/pct.ts';
	import type { Match, Team } from '#lib/types.ts';
	import AllianceChip from '#lib/ui/AllianceChip.svelte';

	interface Props {
		match: Match;
		teams: Team[];
		forecast?: MatchForecast | null;
		followed?: ReadonlySet<number>;
	}

	let { match, teams, forecast = null, followed = new Set() }: Props = $props();

	const names = $derived(new Map(teams.map((team) => [team.number, team.name])));
	const result = $derived(match.result);
</script>

<div class="score-table">
	<table>
		<caption class="visually-hidden">{result ? 'Final score' : 'Alliances'}</caption>
		<colgroup>
			<col class="alliance" />
			<col />
			{#if result}
				<col class="num" />
			{/if}
			{#if forecast}
				<col class="num" />
				<col class="num" />
			{/if}
		</colgroup>
		<thead>
			<tr>
				<th scope="col">Alliance</th>
				<th scope="col">Teams</th>
				{#if result}
					<th scope="col" class="right">Score</th>
				{/if}
				{#if forecast}
					<th scope="col" class="right">Predicted</th>
					<th scope="col" class="right">Win chance</th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each ['red', 'blue'] as const as color (color)}
				{@const won = result?.winner === color}
				<tr>
					<td><AllianceChip alliance={color} /></td>
					<td>
						<div class="teams">
							{#each match[color] as entry (entry.team)}
								<a class={['team', { me: followed.has(entry.team) }]} href="/teams/{entry.team}">
									<b>{entry.team}</b>
									{#if names.get(entry.team)}
										<span class="name">{names.get(entry.team)}</span>
									{/if}
								</a>
							{/each}
						</div>
					</td>
					{#if result}
						<td class={['v', { lean: !won }]}>{result[color].total}</td>
					{/if}
					{#if forecast}
						<td class="v small">{fixed(forecast[color].score, 0)}</td>
						<td class="v small">{pct(forecast[color].win)}</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.teams {
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}

	.team {
		text-decoration: none;
	}

	.team:hover {
		text-decoration: underline;
	}

	.team.me b {
		box-shadow: inset 0 -2px 0 var(--accent);
	}

	.v.small {
		font-size: 15px;
		font-weight: 500;
		color: var(--text-2);
	}

	@media (max-width: 760px) {
		col.num {
			width: 64px;
		}

		th {
			line-height: 1.2;
			vertical-align: bottom;
		}

		.teams {
			align-items: stretch;
			gap: 2px;
		}

		.team {
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			overflow: hidden;
			overflow-wrap: anywhere;
			line-height: 1.3;
		}
	}

	@media (pointer: coarse) {
		.teams {
			gap: 0;
			margin-block: -10px;
		}

		.team {
			padding-block: 10px;
		}
	}
</style>
