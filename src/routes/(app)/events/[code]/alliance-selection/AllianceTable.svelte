<script lang="ts">
	import Table from '#lib/ui/Table.svelte';
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

	function members(alliance: SelectionState['alliances'][number]): number[] {
		return [alliance.captain, ...alliance.picks, ...(alliance.backup ? [alliance.backup] : [])];
	}
</script>

<Table>
	<thead>
		<tr>
			<th class="l" scope="col">#</th>
			<th class="l" scope="col">Captain</th>
			{#each columns as column (column)}
				<th class="l" scope="col">{columns.length > 1 ? `Pick ${column + 1}` : 'Pick'}</th>
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
					<a href="/teams/{alliance.captain}" class:mine={alliance.captain === me}>
						{alliance.captain}
					</a>
				</td>
				{#each columns as column (column)}
					<td class="l">
						{#if alliance.picks[column]}
							<a href="/teams/{alliance.picks[column]}" class:mine={alliance.picks[column] === me}>
								{alliance.picks[column]}
							</a>
						{:else if column === alliance.picks.length && alliance.progress !== 'complete'}
							<span class="faint">{alliance.progress === 'picking' ? 'Picking' : 'Waiting'}</span>
						{/if}
					</td>
				{/each}
				{#if hasBackup}
					<td class="l">
						{#if alliance.backup}
							<a href="/teams/{alliance.backup}" class:mine={alliance.backup === me}>
								{alliance.backup}
							</a>
						{/if}
					</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</Table>

<style>
	.mine {
		font-weight: 600;
	}
</style>
