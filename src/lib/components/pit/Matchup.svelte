<script lang="ts">
	import { fixed } from '#lib/format/number.ts';
	import { ordinal } from '#lib/format/ordinal.ts';
	import { pct } from '#lib/format/pct.ts';
	import type { AllianceColor } from '#lib/types.ts';
	import TeamTag from './TeamTag.svelte';
	import type { NextMatch } from './view.ts';

	interface Props {
		next: NextMatch;
	}

	let { next }: Props = $props();

	const order = $derived<AllianceColor[]>(
		next.alliance === 'red' ? ['red', 'blue'] : ['blue', 'red']
	);
	const forecast = $derived(next.forecast);
	const withOpr = $derived([...next.red, ...next.blue].some((slot) => slot.opr !== null));
	const sides = $derived(
		order.map((alliance) => ({
			alliance,
			slots: next[alliance],
			win: forecast ? forecast[alliance].win : null,
			score: forecast ? forecast[alliance].score : null,
			lean: forecast
				? forecast[alliance].win < forecast[alliance === 'red' ? 'blue' : 'red'].win
				: false
		}))
	);
</script>

<div class={['matchup', { forecast }]}>
	<div class="row head">
		<span>{withOpr ? 'Teams and OPR' : 'Teams and rank'}</span>
		{#if forecast}
			<span class="num">Win chance</span>
			<span class="num">Predicted</span>
		{/if}
	</div>
	{#each sides as side (side.alliance)}
		<div class="row">
			<div class="teams">
				<span class="visually-hidden">{side.alliance === 'red' ? 'Red' : 'Blue'} alliance</span>
				{#each side.slots as slot (slot.number)}
					<span class="slot">
						<TeamTag number={slot.number} alliance={side.alliance} me={slot.me} />
						<small>
							{slot.opr !== null
								? fixed(slot.opr, 1)
								: slot.rank !== null
									? ordinal(slot.rank)
									: ''}
						</small>
					</span>
				{/each}
			</div>
			{#if forecast}
				<span class={['value', { lean: side.lean }]}>{pct(side.win)}</span>
				<span class={['value', { lean: side.lean }]}>{fixed(side.score, 0)}</span>
			{/if}
		</div>
	{/each}
</div>

<style>
	.matchup {
		border: 1px solid var(--line);
		border-radius: 0.35em;
		overflow: hidden;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-items: center;
		gap: 0.6em;
		padding: 0.55em 0.8em;
		border-bottom: 1px solid var(--line);
	}

	.forecast .row {
		grid-template-columns: minmax(0, 1fr) 4.2em 3.6em;
	}

	.row:last-child {
		border-bottom: 0;
	}

	.head {
		padding-block: 0.4em;
		background: var(--surface);
		color: var(--text-3);
		font-size: 0.7em;
	}

	.num {
		text-align: right;
	}

	.teams {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3em 0.7em;
	}

	.slot {
		display: inline-flex;
		align-items: center;
		gap: 0.35em;
		font-size: 1.05em;
	}

	small {
		font-size: 0.7em;
		color: var(--text-2);
	}

	.value {
		text-align: right;
		font-size: 1.35em;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.value.lean {
		font-weight: 500;
		color: var(--text-2);
	}
</style>
