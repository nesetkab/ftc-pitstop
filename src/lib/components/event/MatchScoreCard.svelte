<script lang="ts">
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

<div class="card">
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
	.card {
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		overflow: hidden;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}

	col.alliance {
		width: 98px;
	}

	col.num {
		width: 102px;
	}

	th {
		padding: 8px 6px;
		background: var(--surface);
		color: var(--text-3);
		font-size: 12.5px;
		font-weight: 500;
		text-align: left;
	}

	td {
		padding: 12px 6px;
		border-top: 1px solid var(--line);
		vertical-align: middle;
	}

	th:first-child,
	td:first-child {
		padding-left: 16px;
	}

	th:last-child,
	td:last-child {
		padding-right: 16px;
	}

	.right {
		text-align: right;
	}

	.teams {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		font-size: 14px;
	}

	.team {
		text-decoration: none;
	}

	.team:hover {
		text-decoration: underline;
	}

	.team b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.team.me b {
		box-shadow: inset 0 -2px 0 var(--accent);
	}

	.name {
		color: var(--text-2);
	}

	.v {
		text-align: right;
		font-size: 22px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.v.lean {
		font-weight: 500;
		color: var(--text-2);
	}

	.v.small {
		font-size: 15px;
		font-weight: 500;
		color: var(--text-2);
	}

	@media (max-width: 760px) {
		col.alliance {
			width: 64px;
		}

		col.num {
			width: 64px;
		}

		th,
		td {
			padding-inline: 4px;
		}

		th {
			white-space: nowrap;
		}

		th:first-child,
		td:first-child {
			padding-left: 12px;
		}

		th:last-child,
		td:last-child {
			padding-right: 12px;
		}

		.teams {
			flex-flow: column nowrap;
			gap: 2px;
		}

		.team {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
</style>
