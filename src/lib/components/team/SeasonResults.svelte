<script lang="ts">
	import { fixed, MISSING } from '#lib/format/index.ts';
	import DataTable from '#lib/ui/DataTable.svelte';
	import type { Column, SortDir, SortState } from '#lib/ui/data-table.ts';
	import {
		modelName,
		modelSite,
		type Metric,
		type ModelInfo,
		type SeasonResult
	} from './accuracy.ts';

	interface Props {
		seasons: SeasonResult[];
		models: ModelInfo[];
		chosen: string;
		metric: Metric;
	}

	let { seasons, models, chosen, metric }: Props = $props();

	interface Row {
		id: string;
		site: string | undefined;
		name: string;
	}

	const years = $derived([...seasons].sort((a, b) => b.season - a.season));
	const best = $derived<SortDir>(metric === 'accuracy' ? 'desc' : 'asc');
	const value = (row: Row, season: SeasonResult) => season.models[row.id]?.[metric] ?? null;

	function format(result: number | null): string {
		if (result === null) return MISSING;
		if (metric === 'accuracy') return `${fixed(result * 100, 1)}%`;
		return fixed(result, metric === 'brier' ? 3 : 1);
	}

	const rows = $derived<Row[]>(
		models.map((model) => ({
			id: model.id,
			site: modelSite(model, chosen),
			name: modelName(model)
		}))
	);

	let sort = $derived<SortState | null>(
		years[0] ? { key: String(years[0].season), dir: best } : null
	);

	const columns = $derived<Column<Row>[]>([
		{
			key: 'site',
			label: 'Who uses it',
			sort: (row) => row.site ?? null,
			cell: site
		},
		{
			key: 'model',
			label: 'Model',
			sort: (row) => row.name,
			text: (row) => row.name
		},
		...years.map((season, index): Column<Row> => ({
			key: String(season.season),
			label: String(season.season),
			numeric: true,
			first: best,
			sort: (row) => value(row, season),
			text: (row) => format(value(row, season)),
			hide: index > 2 ? 'phone' : undefined,
			class: 'season'
		}))
	]);
</script>

{#snippet site(row: Row)}
	{#if row.site}{row.site}{:else}<span class="faint">{MISSING}</span>{/if}
{/snippet}

<DataTable
	class="seasons"
	caption="Prediction accuracy by season"
	{rows}
	{columns}
	rowKey={(row) => row.id}
	rowClass={(row) => (row.id === chosen ? 'me' : undefined)}
	bind:sort
/>

<style>
	:global(.seasons table.t td.season::before),
	:global(.seasons table.t td.season::after) {
		display: block;
		height: 0;
		overflow: hidden;
		visibility: hidden;
	}

	:global(.seasons table.t td.season::before) {
		content: '00.0%';
	}

	:global(.seasons table.t td.season::after) {
		content: '0.000';
	}

	:global(.seasons table.t :is(th, td):last-child) {
		padding-right: 10px;
	}

	@media (max-width: 600px) {
		:global(.seasons table.t :is(th, td):last-child) {
			padding-right: 6px;
		}
	}
</style>
