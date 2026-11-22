<script lang="ts">
	import Table from '#lib/ui/Table.svelte';
	import type { CompareRow, CompareTeam } from './compare.ts';

	interface Props {
		teams: CompareTeam[];
		rows: CompareRow[];
	}

	let { teams, rows }: Props = $props();
</script>

<div class="wrap" style:max-width="{240 + 190 * teams.length}px">
	<Table>
		<caption class="visually-hidden">Season stats side by side</caption>
		<thead>
			<tr>
				<th class="l pin" scope="col"><span class="visually-hidden">Measure</span></th>
				{#each teams as team (team.number)}
					<th scope="col" class="team">
						<a href="/teams/{team.number}">{team.number}</a>
						<span class="name">{team.name}</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.key)}
				<tr class:nested={row.nested}>
					<th class="l measure pin" scope="row">{row.label}</th>
					{#each row.values as value, index (index)}
						<td><span class:best={row.best.includes(index)}>{value}</span></td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</Table>
</div>

<style>
	th.team {
		min-width: 120px;
		vertical-align: bottom;
	}

	th.team a {
		display: block;
		color: var(--text);
		font-size: 14px;
		font-weight: 600;
	}

	.name {
		display: block;
		max-width: 180px;
		margin-left: auto;
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 400;
	}

	th.measure {
		padding: 9px 10px;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		font-weight: 400;
		color: var(--text);
	}

	tr.nested th.measure {
		padding-left: 24px;
		color: var(--text-2);
	}

	.pin {
		position: sticky;
		left: 0;
		z-index: 1;
		background: var(--bg);
	}

	.best {
		padding-bottom: 1px;
		border-bottom: 2px solid var(--text);
		font-weight: 600;
	}

	@media (max-width: 600px) {
		th.team {
			min-width: 76px;
		}

		.name {
			max-width: 76px;
		}

		th.measure {
			min-width: 96px;
			white-space: normal;
		}

		tr.nested th.measure {
			padding-left: 12px;
		}

		.pin {
			box-shadow: inset -1px 0 var(--line);
		}
	}
</style>
