<script lang="ts">
	import type { AllianceOdds } from '#lib/analysis/types.ts';
	import { record } from '#lib/format/record.ts';
	import type { AllianceSelection, Team } from '#lib/types.ts';
	import ProbCell from '#lib/ui/ProbCell.svelte';
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';

	interface Props {
		alliances: AllianceSelection[];
		teams: Team[];
		records?: Map<number, { wins: number; losses: number; ties: number }>;
		odds?: AllianceOdds[] | null;
		followed?: ReadonlySet<number>;
	}

	let {
		alliances,
		teams,
		records = new Map(),
		odds = null,
		followed = new Set()
	}: Props = $props();

	const names = $derived(new Map(teams.map((team) => [team.number, team.name])));
	const pickColumns = $derived(Math.max(1, ...alliances.map((alliance) => alliance.picks.length)));
	const hasBackup = $derived(alliances.some((alliance) => alliance.backup !== null));
	const chances = $derived(
		odds ? new Map(odds.map((entry) => [entry.seed, entry.winEvent])) : null
	);
	const showRecord = $derived(records.size > 0);

	function pickLabel(index: number) {
		return ['First pick', 'Second pick', 'Third pick'][index] ?? `Pick ${index + 1}`;
	}

	function mine(alliance: AllianceSelection) {
		return [alliance.captain, ...alliance.picks, alliance.backup].some(
			(team) => team !== null && followed.has(team)
		);
	}
</script>

<Table class="alliances">
	<caption class="visually-hidden">Alliances</caption>
	<thead>
		<tr>
			<th class="l" scope="col">Alliance</th>
			<th class="l" scope="col">Captain</th>
			{#each { length: pickColumns } as _, index (index)}
				<th class="l" scope="col">{pickLabel(index)}</th>
			{/each}
			{#if hasBackup}
				<th class="l" scope="col">Backup</th>
			{/if}
			{#if showRecord}
				<th scope="col">Record</th>
			{/if}
			{#if chances}
				<th scope="col">Win the event</th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each alliances as alliance (alliance.seed)}
			<tr class:me={mine(alliance)}>
				<td class="l">{alliance.seed}</td>
				<td class="team">
					<TeamCell
						number={alliance.captain}
						name={names.get(alliance.captain)}
						href="/teams/{alliance.captain}"
					/>
				</td>
				{#each { length: pickColumns } as _, index (index)}
					{@const pick = alliance.picks[index] ?? null}
					<td class="team">
						{#if pick !== null}
							<TeamCell number={pick} name={names.get(pick)} href="/teams/{pick}" />
						{/if}
					</td>
				{/each}
				{#if hasBackup}
					<td class="team">
						{#if alliance.backup !== null}
							<TeamCell
								number={alliance.backup}
								name={names.get(alliance.backup)}
								href="/teams/{alliance.backup}"
							/>
						{/if}
					</td>
				{/if}
				{#if showRecord}
					{@const entry = records.get(alliance.seed)}
					<td>{entry ? record(entry.wins, entry.losses, entry.ties) : '—'}</td>
				{/if}
				{#if chances}
					<ProbCell p={chances.get(alliance.seed)} />
				{/if}
			</tr>
		{/each}
	</tbody>
</Table>

<style>
	@media (max-width: 600px) {
		:global(.table-wrap.alliances .team-cell .name) {
			display: none;
		}
	}
</style>
