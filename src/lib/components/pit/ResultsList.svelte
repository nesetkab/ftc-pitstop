<script lang="ts">
	import TeamTag from './TeamTag.svelte';
	import { autoScroll } from './auto-scroll.ts';
	import { useOpenMatch } from './open-match.ts';
	import type { ResultRow } from './view.ts';

	interface Props {
		results: ResultRow[];
		team: number;
	}

	let { results, team }: Props = $props();

	const open = useOpenMatch();

	let looping = $state(false);

	// Width a row needs, in text sizes, so the text can shrink instead of being cut off.
	const needed = $derived(
		11 + 7 * Math.max(2, ...results.map((row) => Math.max(row.red.length, row.blue.length)))
	);
</script>

<div class="box" style:--needed={needed} {@attach autoScroll((value) => (looping = value))}>
	<ol class="list" aria-label="All match results">
		{#each results as row (row.key)}
			{@render item(row)}
		{/each}
	</ol>
	{#if looping}
		<ol class="list" aria-hidden="true">
			{#each results as row (row.key)}
				{@render item(row)}
			{/each}
		</ol>
	{/if}
</div>

{#snippet item(row: ResultRow)}
	<li class={{ mine: row.red.includes(team) || row.blue.includes(team) }}>
		<b class="label">{row.label}</b>
		<span class={['side', 'red', { win: row.winner === 'red' }]}>
			{#each row.red as number (number)}<TeamTag
					{number}
					alliance="red"
					me={number === team}
				/>{/each}
		</span>
		<span class="score">
			<span class={{ win: row.winner === 'red' }}>{row.redScore}</span>
			<span class="dash">–</span>
			<span class={{ win: row.winner === 'blue' }}>{row.blueScore}</span>
		</span>
		<span class={['side', 'blue', { win: row.winner === 'blue' }]}>
			{#each row.blue as number (number)}<TeamTag
					{number}
					alliance="blue"
					me={number === team}
				/>{/each}
		</span>
		{#if open}
			<button
				type="button"
				class="open"
				aria-label="Score breakdown for {row.label}"
				onclick={() => open(row.key)}
			></button>
		{/if}
	</li>
{/snippet}

<style>
	.box {
		min-height: 0;
		overflow: hidden auto;
		container-type: inline-size;
	}

	.list {
		font-size: min(0.85em, calc(100cqi / var(--needed)));
		display: grid;
		grid-template-columns: minmax(2.4em, auto) minmax(0, 1fr) auto minmax(0, 1fr);
		column-gap: 0.6em;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.open {
		position: absolute;
		inset: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.open:hover,
	.open:focus-visible {
		box-shadow: inset 0 0 0 2px var(--accent);
	}

	li {
		position: relative;
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		align-items: center;
		padding: 0.32em 0;
		border-bottom: 1px solid var(--line);
		font-variant-numeric: tabular-nums;
	}

	li.mine {
		background: var(--accent-wash);
		margin-inline: -0.5em;
		padding-inline: 0.5em;
	}

	.label {
		white-space: nowrap;
	}

	.side {
		display: flex;
		gap: 0.25em;
		flex-wrap: nowrap;
		min-width: 0;
		overflow: hidden;
		opacity: 0.75;
	}

	.side.blue {
		justify-content: flex-end;
	}

	.side.win {
		opacity: 1;
	}

	.score {
		display: inline-flex;
		gap: 0.3em;
		white-space: nowrap;
		color: var(--text-2);
	}

	.score .win {
		color: var(--text);
		font-weight: 700;
	}

	.dash {
		color: var(--text-3);
	}
</style>
