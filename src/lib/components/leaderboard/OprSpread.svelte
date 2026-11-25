<script lang="ts" module>
	export type SpreadMark = { team: number; opr: number };
</script>

<script lang="ts">
	import { fixed, integer } from '#lib/format/number.ts';
	import { linearScale, niceTicks } from '#lib/ui/chart.ts';
	import type { Spread } from './spread.ts';

	interface Props {
		spread: Spread;
		marks?: SpreadMark[];
		height?: number;
	}

	let { spread, marks = [], height = 128 }: Props = $props();

	const MAX_MARKS = 4;
	const LABEL_ROW = 15;
	const LABEL_GAP = 40;

	let measured = $state(0);
	let active = $state<number | null>(null);

	const width = $derived(measured > 0 ? measured : 600);
	const end = $derived(spread.start + spread.step * spread.counts.length);
	const shown = $derived(
		[...marks]
			.filter((mark) => Number.isFinite(mark.opr))
			.slice(0, MAX_MARKS)
			.sort((a, b) => a.opr - b.opr)
	);
	const left = 6;
	const right = $derived(Math.max(left + 1, width - 6));
	const x = $derived(linearScale([spread.start, end], [left, right]));
	const placed = $derived.by(() => {
		const rows: number[] = [];
		return shown.map((mark) => {
			const at = x(mark.opr);
			let row = 0;
			while (rows[row] !== undefined && at - rows[row] < LABEL_GAP) row++;
			rows[row] = at;
			return { ...mark, x: at, row };
		});
	});
	const labelRows = $derived(Math.max(0, ...placed.map((mark) => mark.row + 1)));
	const plot = $derived({
		left,
		right,
		top: 6 + Math.max(1, labelRows) * LABEL_ROW,
		bottom: height - 22
	});
	const tallest = $derived(Math.max(1, ...spread.counts));
	const slot = $derived((plot.right - plot.left) / spread.counts.length);
	const gap = $derived(slot > 6 ? 1.5 : 0.5);
	const bars = $derived(
		spread.counts.map((count, index) => {
			const lo = spread.start + index * spread.step;
			const tall = count === 0 ? 0 : Math.max(1.5, (count / tallest) * (plot.bottom - plot.top));
			return {
				count,
				lo,
				hi: lo + spread.step,
				x: plot.left + index * slot + gap / 2,
				width: Math.max(0.5, slot - gap),
				y: plot.bottom - tall,
				height: tall
			};
		})
	);
	const ticks = $derived(
		niceTicks(spread.start, end, width < 420 ? 4 : 6).filter(
			(tick) => tick >= spread.start && tick <= end
		)
	);
	const hovered = $derived(active === null ? null : (bars[active] ?? null));

	function range(lo: number, hi: number) {
		return `${tickLabel(lo)} to ${tickLabel(hi)}`;
	}

	function tickLabel(value: number) {
		return Number.isInteger(value) ? integer(value) : fixed(value, 1);
	}

	function teams(count: number) {
		return count === 1 ? '1 team' : `${integer(count)} teams`;
	}

	function anchor(at: number) {
		if (at < 24) return 'start';
		if (at > width - 24) return 'end';
		return 'middle';
	}

	function alignTip(at: number) {
		if (at < 56) return 'start';
		if (at > width - 56) return 'end';
		return 'center';
	}

	function track(event: PointerEvent) {
		const box = (event.currentTarget as Element).getBoundingClientRect();
		const pointer = box.width > 0 ? ((event.clientX - box.left) / box.width) * width : 0;
		const index = Math.floor((pointer - plot.left) / slot);
		active = Math.min(spread.counts.length - 1, Math.max(0, index));
	}
</script>

<div class="spread" bind:clientWidth={measured}>
	<svg
		viewBox="0 0 {width} {height}"
		width="100%"
		{height}
		aria-hidden="true"
		onpointermove={track}
		onpointerleave={() => (active = null)}
	>
		{#each bars as bar, index (index)}
			<rect
				class={['bar', { active: index === active }]}
				x={bar.x}
				y={bar.y}
				width={bar.width}
				height={bar.height}
			/>
		{/each}
		<line class="base" x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} />
		{#each ticks as tick (tick)}
			<text class="tick" x={x(tick)} y={height - 6} text-anchor={anchor(x(tick))}
				>{tickLabel(tick)}</text
			>
		{/each}
		{#each placed as mark (mark.team)}
			<line class="mark" x1={mark.x} x2={mark.x} y1={plot.top} y2={plot.bottom} />
			<text
				class="mark-label"
				x={mark.x}
				y={plot.top - 6 - mark.row * LABEL_ROW}
				text-anchor={anchor(mark.x)}>{mark.team}</text
			>
		{/each}
	</svg>

	{#if hovered}
		<div
			class={['tip', alignTip(hovered.x + hovered.width / 2)]}
			style:left="{hovered.x + hovered.width / 2}px"
			style:top="{plot.top}px"
		>
			<b>{teams(hovered.count)}</b>
			<span>aOPR {range(hovered.lo, hovered.hi)}</span>
		</div>
	{/if}

	<div class="visually-hidden">
		<table>
			<caption>Teams by aOPR</caption>
			<thead>
				<tr>
					<th scope="col">aOPR</th>
					<th scope="col">Teams</th>
				</tr>
			</thead>
			<tbody>
				{#each bars as bar, index (index)}
					{#if bar.count > 0}
						<tr>
							<td>{range(bar.lo, bar.hi)}</td>
							<td>{integer(bar.count)}</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
		{#each shown as mark (mark.team)}
			<p>Team {mark.team} has an aOPR of {fixed(mark.opr)}.</p>
		{/each}
	</div>
</div>

<style>
	.spread {
		position: relative;
		min-width: 0;
	}

	svg {
		display: block;
		overflow: visible;
		touch-action: pan-y;
	}

	.bar {
		fill: var(--line-2);
	}

	.bar.active {
		fill: var(--text-3);
	}

	.base {
		stroke: var(--line-2);
	}

	.mark {
		stroke: var(--accent);
		stroke-width: 2;
	}

	text {
		font: 500 11px var(--font);
		fill: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.mark-label {
		font-weight: 600;
		fill: var(--accent);
	}

	.tip {
		position: absolute;
		display: grid;
		padding: 5px 8px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		font-size: 12px;
		line-height: 1.3;
		white-space: nowrap;
		pointer-events: none;
		transform: translate(-50%, calc(-100% - 6px));
	}

	.tip.start {
		transform: translate(-8px, calc(-100% - 6px));
	}

	.tip.end {
		transform: translate(calc(-100% + 8px), calc(-100% - 6px));
	}

	.tip b {
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.tip span {
		color: var(--text-2);
	}
</style>
