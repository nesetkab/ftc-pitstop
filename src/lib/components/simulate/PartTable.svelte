<script lang="ts">
	import { partLead, type FitPart } from '#lib/components/compare/fit.ts';
	import { oprTerm } from '#lib/format/glossary.ts';
	import { fixed } from '#lib/format/index.ts';
	import { PART_LABELS } from '#lib/game/biobuzz.ts';
	import Table from '#lib/ui/Table.svelte';
	import Term from '#lib/ui/Term.svelte';
	import { colorName, COLORS, type SimSide } from './simulate.ts';

	interface Props {
		red: SimSide;
		blue: SimSide;
	}

	let { red, blue }: Props = $props();

	const EVEN = 0.5;

	type Row = { key: string; label: string; term?: string; nested?: boolean; part?: FitPart };

	const ROWS: Row[] = [
		{ key: 'auto', label: PART_LABELS.auto, term: oprTerm(PART_LABELS.auto), part: 'auto' },
		{ key: 'teleop', label: PART_LABELS.teleop, term: oprTerm(PART_LABELS.teleop), part: 'teleop' },
		{
			key: 'hive',
			label: PART_LABELS.hive,
			term: oprTerm(PART_LABELS.hive),
			part: 'hive',
			nested: true
		},
		{
			key: 'flower',
			label: PART_LABELS.flower,
			term: oprTerm(PART_LABELS.flower),
			part: 'flower',
			nested: true
		},
		{
			key: 'garden',
			label: PART_LABELS.garden,
			term: oprTerm(PART_LABELS.garden),
			part: 'garden',
			nested: true
		},
		{
			key: 'park',
			label: PART_LABELS.park,
			term: oprTerm(PART_LABELS.park),
			part: 'park',
			nested: true
		},
		{ key: 'tips', label: PART_LABELS.tips, term: oprTerm(PART_LABELS.tips), part: 'tips' },
		{ key: 'fouls', label: 'Penalty points drawn' },
		{ key: 'total', label: 'Predicted score' }
	];

	const sides = $derived({ red, blue });

	function value(side: SimSide, row: Row): number {
		if (row.part) return side.parts[row.part];
		return row.key === 'fouls' ? side.fouls : side.score;
	}

	function edge(row: Row): string {
		const gap = value(red, row) - value(blue, row);
		if (Math.abs(gap) < EVEN) return 'Even';
		return `${colorName(gap > 0 ? 'red' : 'blue')} +${fixed(Math.abs(gap))}`;
	}

	function ahead(side: SimSide, row: Row): boolean {
		const other = side.color === 'red' ? blue : red;
		return value(side, row) - value(other, row) >= EVEN;
	}
</script>

<Table>
	<caption class="visually-hidden">Predicted points by part for each alliance</caption>
	<thead>
		<tr>
			<th class="l" scope="col">Part</th>
			{#each COLORS as color (color)}
				<th scope="col">{colorName(color)}</th>
			{/each}
			<th scope="col">Edge</th>
		</tr>
	</thead>
	<tbody>
		{#each ROWS as row (row.key)}
			<tr class:nested={row.nested} class:total={row.key === 'total'}>
				<th class="l part" scope="row">
					{#if row.term}<Term label={row.label} term={row.term} />{:else}{row.label}{/if}
				</th>
				{#each COLORS as color (color)}
					{@const side = sides[color]}
					{@const lead = row.part ? partLead(side.teams, row.part, side.np) : null}
					<td class:ahead={ahead(side, row)}>
						<span class="value">{fixed(value(side, row))}</span>
						{#if lead}<span class="sub">{lead}</span>{/if}
					</td>
				{/each}
				<td class="edge">{edge(row)}</td>
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
		vertical-align: top;
	}

	tr.nested th.part {
		padding-left: 24px;
		color: var(--text-2);
	}

	tr.total th.part,
	tr.total td {
		font-weight: 600;
	}

	td {
		vertical-align: top;
	}

	td.ahead .value {
		font-weight: 600;
	}

	.value,
	.sub {
		display: block;
	}

	.sub {
		font-size: 12.5px;
		color: var(--text-3);
	}

	.edge {
		color: var(--text-2);
		white-space: nowrap;
	}

	@media (max-width: 600px) {
		th.part {
			padding-inline: 6px;
			white-space: normal;
		}

		tr.nested th.part {
			padding-left: 12px;
		}
	}
</style>
