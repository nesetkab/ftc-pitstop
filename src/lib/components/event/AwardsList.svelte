<script lang="ts">
	import Brand from '#lib/ui/Brand.svelte';
	import type { Award, Team } from '#lib/types.ts';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import { groupAwards } from './awards.ts';

	interface Props {
		awards: Award[];
		teams: Team[];
		followed?: ReadonlySet<number>;
	}

	let { awards, teams, followed = new Set() }: Props = $props();

	const names = $derived(new Map(teams.map((team) => [team.number, team.name])));
	const groups = $derived(groupAwards(awards));
</script>

<Table>
	<caption class="visually-hidden">Awards</caption>
	<thead>
		<tr>
			<th class="l" scope="col">Award</th>
			<th class="l" scope="col">Place</th>
			<th class="l" scope="col">Winner</th>
		</tr>
	</thead>
	{#each groups as group (group.id)}
		<tbody>
			{#each group.entries as entry, index (index)}
				<tr class:me={entry.team !== null && followed.has(entry.team)}>
					{#if index === 0}
						<th class="l award" scope="rowgroup" rowspan={group.entries.length}
							><Brand text={group.name} /></th
						>
					{/if}
					<td class="l muted">{entry.label ?? ''}</td>
					<td class="team wrap">
						{#if entry.person}
							<span>{entry.person}</span>
							{#if entry.team !== null}
								<span class="muted">of</span>
								<TeamCell number={entry.team} href="/teams/{entry.team}" />
							{/if}
						{:else if entry.team !== null}
							<TeamCell
								number={entry.team}
								name={names.get(entry.team)}
								href="/teams/{entry.team}"
							/>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	{/each}
</Table>

<style>
	th.award {
		padding: 9px 10px;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
		text-align: left;
		vertical-align: top;
		white-space: normal;
		min-width: 180px;
	}

	@media (max-width: 600px) {
		th.award {
			width: 30%;
			padding-inline: 6px;
			min-width: 0;
		}
	}
</style>
