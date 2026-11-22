<script lang="ts">
	import type { PlayedMatch } from '#lib/components/event/report.ts';
	import { matchHref } from '#lib/components/event/matches.ts';
	import { integer } from '#lib/format/number.ts';

	interface Props {
		code: string;
		matches: PlayedMatch[];
		scale: number;
		average: number | null;
	}

	let { code, matches, scale, average }: Props = $props();

	const SLOT = 30;
	const BAR = 20;
	const TOP = 14;
	const HEIGHT = 64;
	const LABEL = 14;

	const width = $derived(Math.max(1, matches.length) * SLOT);
	const total = TOP + HEIGHT + LABEL;
	const y = (score: number) => TOP + HEIGHT - (Math.max(0, score) / scale) * HEIGHT;
	const words = { win: 'win', loss: 'loss', tie: 'tie' } as const;
	const summary = $derived(
		matches
			.map((match) => `${match.label} ${integer(match.score)} ${words[match.result]}`)
			.join(', ')
	);
</script>

<svg
	class="strip"
	viewBox="0 0 {width} {total}"
	{width}
	height={total}
	role="img"
	aria-label="Alliance score by match: {summary}"
>
	{#if average !== null}
		<line class="avg" x1="0" x2={width} y1={y(average)} y2={y(average)} />
	{/if}
	<line class="base" x1="0" x2={width} y1={TOP + HEIGHT} y2={TOP + HEIGHT} />
	{#each matches as match, index (match.key)}
		{@const x = index * SLOT + (SLOT - BAR) / 2}
		<a href={matchHref(code, match)}>
			<title
				>{match.label}: {integer(match.score)} to {integer(match.opponentScore)}, {words[
					match.result
				]}</title
			>
			<rect
				class={[match.alliance, match.result]}
				{x}
				y={y(match.score)}
				width={BAR}
				height={Math.max(1, TOP + HEIGHT - y(match.score))}
			/>
			<text class="score" x={x + BAR / 2} y={y(match.score) - 3}>{integer(match.score)}</text>
			<text class="label" x={x + BAR / 2} y={total - 2}>{match.label}</text>
		</a>
	{/each}
</svg>

<style>
	.strip {
		max-width: 100%;
		height: auto;
		overflow: visible;
	}

	.red {
		fill: var(--red);
	}

	.blue {
		fill: var(--blue);
	}

	.loss {
		fill-opacity: 0.4;
	}

	.tie {
		fill-opacity: 0.7;
	}

	.base {
		stroke: var(--line-2);
		stroke-width: 1;
	}

	.avg {
		stroke: var(--text-3);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}

	text {
		font-size: 9.5px;
		font-variant-numeric: tabular-nums;
		text-anchor: middle;
		fill: var(--text-2);
	}

	.label {
		fill: var(--text-3);
	}

	a:hover rect {
		fill-opacity: 1;
		stroke: var(--text);
		stroke-width: 1;
	}

	a:focus-visible {
		outline: none;
	}

	a:focus-visible rect {
		stroke: var(--text);
		stroke-width: 2;
	}
</style>
