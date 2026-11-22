<script lang="ts" module>
	export type PredictionTeam = { number: number; name?: string | null };
	export type PredictionSide = {
		teams: PredictionTeam[];
		win: number | null;
		score: number | null;
	};
</script>

<script lang="ts">
	import Term from './Term.svelte';
	import { fixed } from '#lib/format/number.ts';
	import { pct } from '#lib/format/pct.ts';
	import AllianceChip from './AllianceChip.svelte';
	import TeamChip from './TeamChip.svelte';

	interface Props {
		red: PredictionSide;
		blue: PredictionSide;
		me?: number;
		compact?: boolean;
		caption?: string;
	}

	let { red, blue, me, compact = false, caption = 'Prediction' }: Props = $props();

	const sides = $derived([
		{ alliance: 'red' as const, side: red, lean: (blue.win ?? 0) > (red.win ?? 0) },
		{ alliance: 'blue' as const, side: blue, lean: (red.win ?? 0) > (blue.win ?? 0) }
	]);
</script>

<div class={['pred', { compact }]}>
	<table>
		<caption class="visually-hidden">{caption}</caption>
		<colgroup>
			{#if !compact}
				<col class="alliance" />
			{/if}
			<col />
			<col class="num" />
			<col class="num" />
		</colgroup>
		<thead>
			<tr>
				{#if !compact}
					<th scope="col">Alliance</th>
				{/if}
				<th scope="col">{compact ? 'Alliance' : 'Teams'}</th>
				<th scope="col" class="right">{compact ? 'Win' : 'Win chance'}</th>
				<th scope="col" class="right"
					>{#if compact}<Term label="Pred." />{:else}Predicted{/if}</th
				>
			</tr>
		</thead>
		<tbody>
			{#each sides as { alliance, side, lean } (alliance)}
				<tr>
					{#if !compact}
						<td><AllianceChip {alliance} /></td>
					{/if}
					<td>
						<div class="teams">
							{#if compact}
								<span class={['side-name', alliance]}>{alliance === 'red' ? 'Red' : 'Blue'}</span>
							{/if}
							{#each side.teams as team (team.number)}
								{#if compact}
									<TeamChip number={team.number} {alliance} me={team.number === me} />
								{:else}
									<span class="team">
										<b>{team.number}</b>
										{#if team.name}
											<span class="name">{team.name}</span>
										{/if}
									</span>
								{/if}
							{/each}
						</div>
					</td>
					<td class={['v', { lean }]}>{pct(side.win)}</td>
					<td class={['v', { lean }]}>{fixed(side.score, 0)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.pred {
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

	.team b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
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

	.compact col.num {
		width: 68px;
	}

	.compact td {
		padding-block: 12px;
	}

	.compact .teams {
		align-items: center;
		gap: 6px;
	}

	.side-name {
		width: 2.6em;
		font-size: 12.5px;
		font-weight: 500;
	}

	.side-name.red {
		color: var(--red);
	}

	.side-name.blue {
		color: var(--blue);
	}

	.compact .v {
		font-size: 18px;
	}

	@media (max-width: 760px) {
		col.alliance {
			width: 64px;
		}

		col.num {
			width: 76px;
		}

		.compact col.num {
			width: 60px;
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

		td {
			padding-block: 10px;
		}

		.pred:not(.compact) .teams {
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
