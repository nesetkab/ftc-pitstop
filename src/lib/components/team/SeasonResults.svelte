<script lang="ts">
	import { fixed, integer } from '#lib/format/index.ts';
	import Table from '#lib/ui/Table.svelte';
	import { splitNote, type ModelInfo, type SeasonResult } from './accuracy.ts';

	interface Props {
		seasons: SeasonResult[];
		models: ModelInfo[];
		chosen: string;
	}

	let { seasons, models, chosen }: Props = $props();

	const ordered = $derived([...seasons].sort((a, b) => b.season - a.season));
	const percent = (value: number) => `${fixed(value * 100, 1)}%`;
</script>

<Table>
	<thead>
		<tr>
			<th class="l" scope="col">Model</th>
			<th scope="col">Winner accuracy</th>
			<th scope="col">Brier score</th>
			<th scope="col">Log loss</th>
			<th scope="col">Score error</th>
		</tr>
	</thead>
	{#each ordered as season (season.season)}
		<tbody>
			<tr>
				<th class="season l" scope="rowgroup" colspan="5">
					{season.season}, {season.game}
					<span class="faint">
						{integer(season.n)} matches{splitNote(season.split)
							? `. ${splitNote(season.split)}`
							: ''}
					</span>
				</th>
			</tr>
			{#each models as model (model.id)}
				{@const result = season.models[model.id]}
				{#if result}
					<tr class:chosen={model.id === chosen}>
						<td class="l wrap model">
							{model.label}
							{#if model.id === chosen}
								<span class="tag">Used on this site</span>
							{/if}
						</td>
						<td>{percent(result.accuracy)}</td>
						<td>{fixed(result.brier, 3)}</td>
						<td>{fixed(result.logloss, 3)}</td>
						<td>{fixed(result.mae, 1)}</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	{/each}
</Table>

<style>
	th.season {
		padding: 22px 10px 8px;
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		white-space: normal;
	}

	th.season span {
		margin-left: 8px;
		font-size: 13px;
		font-weight: 400;
	}

	td.model {
		min-width: 12em;
	}

	tr.chosen td {
		background: var(--accent-wash);
	}

	@media (max-width: 640px) {
		th.season span {
			display: block;
			margin: 2px 0 0;
		}
	}

	.tag {
		display: block;
		font-size: 12.5px;
		color: var(--text-2);
	}
</style>
