<script lang="ts">
	import { fixed, integer, shortDate } from '#lib/format/index.ts';
	import { linearScale, niceTicks } from '#lib/ui/chart.ts';
	import { reveal } from '#lib/ui/motion.ts';
	import type { CompareTeam } from './compare.ts';
	import type { TrendLine } from './trend.ts';

	interface Props {
		teams: CompareTeam[];
		lines: TrendLine[];
		height?: number;
	}

	let { teams, lines, height = 240 }: Props = $props();

	const margin = { top: 16, right: 48, bottom: 28, left: 34 };
	const LABEL_GAP = 13;
	const TICK_GAP = 52;

	let measured = $state(0);
	let active = $state<{ line: number; point: number } | null>(null);

	const width = $derived(measured > 0 ? measured : 600);
	const series = $derived(
		lines
			.map((line, index) => ({
				...line,
				slot: teams.findIndex((team) => team.number === line.number),
				order: index
			}))
			.filter((line) => line.points.length > 0)
	);
	const times = $derived(series.flatMap((line) => line.points.map((p) => Date.parse(p.start))));
	const ticks = $derived(
		niceTicks(0, Math.max(...series.flatMap((line) => line.points.map((p) => p.opr))), 4)
	);
	const plot = $derived({
		left: margin.left,
		right: Math.max(margin.left + 1, width - margin.right),
		top: margin.top,
		bottom: height - margin.bottom
	});
	const x = $derived(
		linearScale([Math.min(...times), Math.max(...times)], [plot.left, plot.right])
	);
	const y = $derived(linearScale([ticks[0], ticks[ticks.length - 1]], [plot.bottom, plot.top]));
	const drawn = $derived(
		series.map((line) => {
			const coords = line.points.map((point) => ({
				...point,
				x: x(Date.parse(point.start)),
				y: y(point.opr)
			}));
			return {
				...line,
				coords,
				path: coords
					.map((p, index) => `${index === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
					.join(' ')
			};
		})
	);
	const ends = $derived.by(() => {
		const marks = drawn.flatMap((line) =>
			line.coords.flatMap((point, index) => {
				const next = line.coords[index + 1];
				if (!next) return [{ number: line.number, x: point.x, y: point.y }];
				return Array.from({ length: 8 }, (_, step) => ({
					number: line.number,
					x: point.x + ((next.x - point.x) * step) / 8,
					y: point.y + ((next.y - point.y) * step) / 8
				}));
			})
		);
		const placed: { number: number; x: number; y: number }[] = [];
		const clear = (number: number, x: number, y: number) =>
			marks.every(
				(mark) =>
					mark.number === number ||
					mark.x < x - 5 ||
					mark.x > x + 36 ||
					mark.y < y - 15 ||
					mark.y > y + 5
			) &&
			placed.every((label) => Math.abs(label.x - x) >= 40 || Math.abs(label.y - y) >= LABEL_GAP);
		const order = drawn
			.map((line) => ({ number: line.number, last: line.coords[line.coords.length - 1] }))
			.sort((a, b) => a.last.y - b.last.y);
		for (const { number, last } of order) {
			const x = last.x + 8;
			const base = last.y + 4;
			const offsets = [0, 1, -1, 2, -2, 3, -3].map((step) => base + step * LABEL_GAP);
			const y = offsets.find((at) => clear(number, x, at)) ?? base;
			placed.push({ number, x, y: Math.min(plot.bottom + 4, Math.max(plot.top + 4, y)) });
		}
		return placed;
	});
	const dates = $derived.by(() => {
		const starts = [...new Set(series.flatMap((line) => line.points.map((p) => p.start)))].sort(
			(a, b) => b.localeCompare(a)
		);
		const kept: { start: string; x: number }[] = [];
		for (const start of starts) {
			const at = x(Date.parse(start));
			if (kept.every((tick) => Math.abs(tick.x - at) >= TICK_GAP)) kept.push({ start, x: at });
		}
		return kept;
	});
	const hovered = $derived.by(() => {
		if (!active) return null;
		const line = drawn[active.line];
		const point = line?.coords[active.point];
		return point ? { line, point } : null;
	});

	function nameOf(number: number) {
		return teams.find((team) => team.number === number)?.name ?? '';
	}

	function tickLabel(value: number) {
		return Number.isInteger(value) ? integer(value) : fixed(value, 1);
	}

	function alignTip(at: number) {
		if (at < 80) return 'start';
		if (at > width - 80) return 'end';
		return 'center';
	}

	function track(event: PointerEvent) {
		const box = (event.currentTarget as Element).getBoundingClientRect();
		if (box.width === 0) return;
		const px = ((event.clientX - box.left) / box.width) * width;
		const py = ((event.clientY - box.top) / box.height) * height;
		let best = { line: -1, point: -1, distance: Number.POSITIVE_INFINITY };
		for (const [lineIndex, line] of drawn.entries()) {
			for (const [pointIndex, point] of line.coords.entries()) {
				const distance = Math.hypot(point.x - px, (point.y - py) * 0.6);
				if (distance < best.distance) best = { line: lineIndex, point: pointIndex, distance };
			}
		}
		active = best.line >= 0 ? { line: best.line, point: best.point } : null;
	}
</script>

<div class="season">
	<ul class="key">
		{#each series as line (line.number)}
			<li>
				<span class="swatch s{line.slot}" aria-hidden="true"></span>
				<b>{line.number}</b>
				<span class="name">{nameOf(line.number)}</span>
			</li>
		{/each}
	</ul>

	<div class="chart" bind:clientWidth={measured} {@attach reveal}>
		<svg
			viewBox="0 0 {width} {height}"
			width="100%"
			{height}
			aria-hidden="true"
			onpointermove={track}
			onpointerleave={() => (active = null)}
		>
			{#each ticks as tick (tick)}
				<line class="grid" x1={plot.left} x2={plot.right} y1={y(tick)} y2={y(tick)} />
				<text class="tick" x={plot.left - 8} y={y(tick) + 4} text-anchor="end"
					>{tickLabel(tick)}</text
				>
			{/each}
			{#each dates as tick (tick.start)}
				<text class="tick" x={tick.x} y={height - 8} text-anchor="middle"
					>{shortDate(tick.start)}</text
				>
			{/each}
			{#if hovered}
				<line
					class="cross"
					x1={hovered.point.x}
					x2={hovered.point.x}
					y1={plot.top}
					y2={plot.bottom}
				/>
			{/if}
			{#each drawn as line, lineIndex (line.number)}
				<g class="s{line.slot}" class:dim={hovered !== null && hovered.line !== line}>
					<path class="line" d={line.path} pathLength="1" />
					{#each line.coords as point, pointIndex (point.code)}
						<circle
							class={[
								'point',
								{ active: active?.line === lineIndex && active.point === pointIndex }
							]}
							cx={point.x}
							cy={point.y}
							r="4"
						/>
					{/each}
				</g>
			{/each}
			{#each ends as end (end.number)}
				<text class="end" x={end.x} y={end.y}>{end.number}</text>
			{/each}
		</svg>

		{#if hovered}
			<div
				class={['tip', alignTip(hovered.point.x)]}
				style:left="{hovered.point.x}px"
				style:top="{hovered.point.y}px"
			>
				<b>{fixed(hovered.point.opr)}</b>
				<span>{hovered.line.number} at {hovered.point.event}</span>
				<span>{shortDate(hovered.point.start)}</span>
			</div>
		{/if}
	</div>

	<div class="visually-hidden">
		<table>
			<caption>Season aOPR after each event</caption>
			<thead>
				<tr>
					<th scope="col">Team</th>
					<th scope="col">Event</th>
					<th scope="col">Date</th>
					<th scope="col">aOPR</th>
				</tr>
			</thead>
			<tbody>
				{#each series as line (line.number)}
					{#each line.points as point (point.code)}
						<tr>
							<td>{line.number}</td>
							<td>{point.event}</td>
							<td>{shortDate(point.start)}</td>
							<td>{fixed(point.opr)}</td>
						</tr>
					{/each}
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.season {
		--s0: #0085a3;
		--s1: #e0661f;
		--s2: #6a4ce2;
		--s3: #c2407a;
		display: grid;
		gap: 10px;
		min-width: 0;
	}

	@media screen and (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .season {
			--s0: #29adc4;
			--s1: #e76624;
			--s2: #9887ef;
			--s3: #e24d8b;
		}
	}

	@media screen {
		:global(:root[data-theme='dark']) .season {
			--s0: #29adc4;
			--s1: #e76624;
			--s2: #9887ef;
			--s3: #e24d8b;
		}
	}

	.key {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 13px;
	}

	.key li {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.key b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.key .name {
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-2);
	}

	.swatch {
		width: 14px;
		height: 3px;
		border-radius: 2px;
		background: var(--series);
	}

	.s0 {
		--series: var(--s0);
	}

	.s1 {
		--series: var(--s1);
	}

	.s2 {
		--series: var(--s2);
	}

	.s3 {
		--series: var(--s3);
	}

	.chart {
		position: relative;
		min-width: 0;
	}

	svg {
		display: block;
		overflow: visible;
		touch-action: pan-y;
	}

	.grid {
		stroke: var(--line);
	}

	.cross {
		stroke: var(--line-2);
	}

	.line {
		fill: none;
		stroke: var(--series);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.point {
		fill: var(--bg);
		stroke: var(--series);
		stroke-width: 2;
	}

	.point.active {
		fill: var(--series);
	}

	g {
		transition: opacity 120ms ease-out;
	}

	g.dim {
		opacity: 0.35;
	}

	.chart:global([data-reveal]) .line {
		stroke-dasharray: 1;
	}

	.chart:global([data-reveal='draw']) .line {
		transition: stroke-dashoffset 700ms cubic-bezier(0.33, 1, 0.68, 1);
	}

	.chart:global([data-reveal='draw']) .point {
		transition: opacity 300ms ease-out 400ms;
	}

	.chart:global([data-reveal='wait']) .line {
		stroke-dashoffset: 1;
	}

	.chart:global([data-reveal='wait']) .point {
		opacity: 0;
	}

	text {
		font: 500 11px var(--font);
		fill: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	text.end {
		font-weight: 600;
		fill: var(--text-2);
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
		transform: translate(-50%, calc(-100% - 10px));
	}

	.tip.start {
		transform: translate(-8px, calc(-100% - 10px));
	}

	.tip.end {
		transform: translate(calc(-100% + 8px), calc(-100% - 10px));
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
