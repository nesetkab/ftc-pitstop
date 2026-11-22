<script lang="ts">
	import { fixed, integer } from '#lib/format/index.ts';
	import Table from '#lib/ui/Table.svelte';
	import type { AccuracyReport } from './accuracy.ts';

	interface Props {
		schedule: NonNullable<AccuracyReport['schedule']>;
	}

	let { schedule }: Props = $props();

	const groups = $derived(
		[
			{
				key: 'quals',
				title: 'Qualification matches',
				data: schedule.quals,
				events: schedule.events?.quals
			},
			{
				key: 'playoffs',
				title: 'Playoff matches',
				data: schedule.playoffs,
				events: schedule.events?.playoffs
			}
		].flatMap((group) => (group.data ? [{ ...group, data: group.data }] : []))
	);
</script>

<Table>
	<thead>
		<tr>
			<td></td>
			<th class="group" scope="colgroup" colspan={schedule.ahead.length}>Matches ahead</th>
		</tr>
		<tr>
			<th class="l" scope="col">Median error in minutes</th>
			{#each schedule.ahead as count (count)}
				<th scope="col">{count}</th>
			{/each}
		</tr>
	</thead>
	{#each groups as group (group.key)}
		<tbody>
			<tr>
				<th class="section l" scope="rowgroup" colspan={schedule.ahead.length + 1}>
					{group.title}
					{#if group.events !== undefined}
						<span class="faint">{integer(group.events)} events</span>
					{/if}
				</th>
			</tr>
			<tr>
				<td class="l wrap label">Our estimate</td>
				{#each group.data.estimator as value, index (index)}
					<td>{fixed(value, 1)}</td>
				{/each}
			</tr>
			<tr>
				<td class="l wrap label">Printed schedule plus current delay</td>
				{#each group.data.delay as value, index (index)}
					<td>{fixed(value, 1)}</td>
				{/each}
			</tr>
			<tr>
				<td class="l wrap label">Printed schedule</td>
				{#each group.data.scheduled as value, index (index)}
					<td>{fixed(value, 1)}</td>
				{/each}
			</tr>
			<tr class="dim">
				<td class="l wrap label">Estimates measured</td>
				{#each group.data.n as value, index (index)}
					<td>{integer(value)}</td>
				{/each}
			</tr>
		</tbody>
	{/each}
</Table>

<style>
	td.label {
		min-width: 9em;
	}

	@media (max-width: 600px) {
		td.label {
			min-width: 7em;
		}
	}

	th.section {
		padding: 22px 10px 8px;
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}

	th.section span {
		margin-left: 8px;
		font-size: 13px;
		font-weight: 400;
	}
</style>
