<script lang="ts">
	import { fixed, MISSING, signed } from '#lib/format/index.ts';
	import Table from '#lib/ui/Table.svelte';
	import {
		INSIGHT_PARTS,
		type InsightPart,
		type PartAverages,
		type PartValues
	} from './insights.ts';

	interface Props {
		qual: PartAverages | null;
		playoff: PartAverages | null;
		event: PartAverages | null;
		high: PartValues | null;
		season: PartAverages | null;
	}

	let { qual, playoff, event, high, season }: Props = $props();

	const NESTED = new Set<InsightPart>(['hive', 'flower', 'garden', 'park']);

	function value(source: PartValues | null, key: InsightPart, digits = 1): string {
		return source ? fixed(source[key], digits) : MISSING;
	}

	function gap(key: InsightPart): string {
		return event && season ? signed(event[key] - season[key]) : MISSING;
	}
</script>

<Table>
	<caption class="visually-hidden">Average alliance score by part</caption>
	<thead>
		<tr>
			<th class="l" scope="col">Part</th>
			<th class={{ opt: playoff }} scope="col">Quals</th>
			{#if playoff}
				<th class="opt" scope="col">Playoffs</th>
				<th scope="col">All matches</th>
			{/if}
			<th class="opt" scope="col">Best here</th>
			{#if season}
				<th class="sep" scope="col">Season</th>
				<th scope="col">Vs season</th>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each INSIGHT_PARTS as part (part.key)}
			<tr>
				<th class={['l', 'part', { nested: NESTED.has(part.key) }]} scope="row">{part.label}</th>
				<td class={{ strong: part.key === 'total', opt: playoff }}>{value(qual, part.key)}</td>
				{#if playoff}
					<td class={{ strong: part.key === 'total', opt: true }}>{value(playoff, part.key)}</td>
					<td class={{ strong: part.key === 'total' }}>{value(event, part.key)}</td>
				{/if}
				<td class="opt">{value(high, part.key, 0)}</td>
				{#if season}
					<td class="sep muted">{value(season, part.key)}</td>
					<td>{gap(part.key)}</td>
				{/if}
			</tr>
		{/each}
	</tbody>
</Table>

<style>
	th.part {
		padding: 9px 10px;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		font-weight: 400;
		color: var(--text);
	}

	th.nested {
		padding-left: 24px;
		color: var(--text-2);
	}

	td.strong {
		font-weight: 600;
	}

	@media (max-width: 600px) {
		th.part {
			padding-inline: 6px;
		}

		th.nested {
			padding-left: 16px;
		}
	}
</style>
