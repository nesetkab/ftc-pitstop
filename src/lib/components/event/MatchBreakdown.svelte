<script lang="ts">
	import { POINTS } from '#lib/game/biobuzz.ts';
	import type { MatchResult, RobotPair, ScoreBreakdown } from '#lib/types.ts';
	import AllianceChip from '#lib/ui/AllianceChip.svelte';
	import Table from '#lib/ui/Table.svelte';
	import FlowerStacks from './FlowerStacks.svelte';

	interface Props {
		result: MatchResult;
	}

	let { result }: Props = $props();

	type Line = {
		label: string;
		kind: 'head' | 'item' | 'total';
		count?: (breakdown: ScoreBreakdown) => number | null;
		points: (breakdown: ScoreBreakdown, color: 'red' | 'blue') => number | null;
	};

	const robots = (pair: RobotPair) => Number(pair[0]) + Number(pair[1]);

	const lines: Line[] = [
		{ label: 'Auto', kind: 'head', points: (b) => b.points.auto },
		{
			label: 'Leave',
			kind: 'item',
			count: (b) => robots(b.auto.leave),
			points: (b) => b.points.autoLeave
		},
		{
			label: 'Park',
			kind: 'item',
			count: (b) => robots(b.auto.park),
			points: (b) => b.points.autoPark
		},
		{
			label: 'Tips',
			kind: 'item',
			count: (b) => b.auto.tips,
			points: (b) => b.points.autoHive
		},
		{ label: 'Teleop', kind: 'head', points: (b) => b.points.teleop },
		{
			label: 'Tips',
			kind: 'item',
			count: (b) => b.teleop.tips,
			points: (b) => b.teleop.tips * POINTS.tip
		},
		{
			label: 'Cell balls',
			kind: 'item',
			count: (b) => b.teleop.cellBalls,
			points: (b) => b.teleop.cellBalls * POINTS.cellBall
		},
		{ label: 'Flowers', kind: 'item', points: (b) => b.points.teleopFlower },
		{
			label: 'Garden balls',
			kind: 'item',
			count: (b) => b.teleop.gardenBalls,
			points: (b) => b.points.teleopGarden
		},
		{
			label: 'Park',
			kind: 'item',
			count: (b) => robots(b.teleop.park),
			points: (b) => b.points.teleopPark
		},
		{ label: 'Fouls committed', kind: 'head', points: () => null },
		{ label: 'Minor', kind: 'item', count: (b) => b.minorFouls, points: () => null },
		{ label: 'Major', kind: 'item', count: (b) => b.majorFouls, points: () => null },
		{
			label: "Points from the other alliance's fouls",
			kind: 'item',
			points: (_, color) => result[color].foulPoints
		},
		{ label: 'Total', kind: 'total', points: (_, color) => result[color].total }
	];

	const sides = $derived(
		(['red', 'blue'] as const).flatMap((color) => {
			const breakdown = result[color].breakdown;
			return breakdown ? [{ color, breakdown }] : [];
		})
	);

	const flowers = $derived(
		result.red.breakdown?.teleop.flowers ?? result.blue.breakdown?.teleop.flowers
	);
</script>

{#if sides.length === 2}
	<Table>
		<caption class="visually-hidden">Score breakdown</caption>
		<thead>
			<tr>
				<td></td>
				<th colspan="2" scope="colgroup" class="group"><AllianceChip alliance="red" /></th>
				<th colspan="2" scope="colgroup" class="group sep"><AllianceChip alliance="blue" /></th>
			</tr>
			<tr>
				<th class="l" scope="col"><span class="visually-hidden">Part</span></th>
				<th scope="col">Count</th>
				<th scope="col">Points</th>
				<th scope="col" class="sep">Count</th>
				<th scope="col">Points</th>
			</tr>
		</thead>
		<tbody>
			{#each lines as line, index (index)}
				<tr class={line.kind}>
					<th scope="row" class="l">{line.label}</th>
					{#each sides as { color, breakdown } (color)}
						{@const points = line.points(breakdown, color)}
						<td class:sep={color === 'blue'}>{line.count?.(breakdown) ?? ''}</td>
						<td class:won={line.kind === 'total' && result.winner === color}>{points ?? ''}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</Table>
	{#if flowers}
		<div class="panel">
			<h3 class="sec-title">Flowers at the end of the match</h3>
			<FlowerStacks {flowers} />
		</div>
	{/if}
{:else}
	<p class="muted">The detailed score breakdown isn't available for this match.</p>
{/if}

<style>
	th[scope='row'] {
		padding: 9px 10px;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		font-weight: 400;
		color: var(--text);
		text-align: left;
		white-space: normal;
	}

	tr.item th[scope='row'] {
		padding-left: 22px;
		color: var(--text-2);
	}

	tr.head th[scope='row'],
	tr.head td,
	tr.total th[scope='row'],
	tr.total td {
		font-weight: 600;
	}

	tr.total td.won {
		color: var(--text);
	}

	tr.total td:not(.won) {
		color: var(--text-2);
	}

	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 12px;
		align-content: start;
	}

	h3.sec-title {
		font-size: 15px;
		line-height: 1.4;
		letter-spacing: 0;
	}
</style>
