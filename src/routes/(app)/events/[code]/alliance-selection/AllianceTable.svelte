<script lang="ts">
	import Table from '#lib/ui/Table.svelte';
	import TeamCell from '#lib/ui/TeamCell.svelte';
	import type { SelectionState } from '#lib/workspace/selection.ts';

	interface Props {
		selection: SelectionState;
		me?: number | null;
	}

	let { selection, me = null }: Props = $props();

	const columns = $derived(
		Array.from(
			{ length: Math.max(1, ...selection.alliances.map((alliance) => alliance.picks.length)) },
			(_, index) => index
		)
	);
	const hasBackup = $derived(selection.alliances.some((alliance) => alliance.backup !== null));

	function pickLabel(index: number) {
		return ['First pick', 'Second pick', 'Third pick'][index] ?? `Pick ${index + 1}`;
	}

	function members(alliance: SelectionState['alliances'][number]): number[] {
		return [alliance.captain, ...alliance.picks, ...(alliance.backup ? [alliance.backup] : [])];
	}
</script>

<Table>
	<thead>
		<tr>
			<th class="l" scope="col">Alliance</th>
			<th class="l" scope="col">Captain</th>
			{#each columns as column (column)}
				<th class="l" scope="col">{pickLabel(column)}</th>
			{/each}
			{#if hasBackup}
				<th class="l" scope="col">Backup</th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each selection.alliances as alliance (alliance.seed)}
			<tr class:me={me !== null && members(alliance).includes(me)}>
				<td class="l">{alliance.seed}</td>
				<td class="l">
					<TeamCell number={alliance.captain} href="/teams/{alliance.captain}" />
				</td>
				{#each columns as column (column)}
					<td class="l">
						{#if alliance.picks[column]}
							<TeamCell number={alliance.picks[column]} href="/teams/{alliance.picks[column]}" />
						{:else if column === alliance.picks.length && alliance.progress !== 'complete'}
							<span class="faint">{alliance.progress === 'picking' ? 'Picking' : 'Waiting'}</span>
						{/if}
					</td>
				{/each}
				{#if hasBackup}
					<td class="l">
						{#if alliance.backup}
							<TeamCell number={alliance.backup} href="/teams/{alliance.backup}" />
						{/if}
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</Table>
