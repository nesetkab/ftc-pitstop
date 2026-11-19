<script lang="ts">
	import { bottomNectar, FLOWER_NAMES, flowerOwner } from '#lib/game/biobuzz.ts';
	import type { FlowerElement, Flowers } from '#lib/types.ts';

	interface Props {
		flowers: Flowers;
	}

	let { flowers }: Props = $props();

	const LABELS: Record<keyof Flowers, string> = {
		red: 'Red alliance flower',
		blue: 'Blue alliance flower',
		scoring: 'Scoring flower',
		audience: 'Audience flower'
	};

	const ELEMENTS: Record<FlowerElement, string> = {
		red: 'red nectar',
		blue: 'blue nectar',
		pollen: 'pollen'
	};

	const height = $derived(Math.max(3, ...FLOWER_NAMES.map((name) => flowers[name].length)));

	function describe(stack: FlowerElement[]): string {
		if (stack.length === 0) return 'Empty';
		const parts = stack.map((element) => ELEMENTS[element]).join(', ');
		return `Bottom to top: ${parts}`;
	}

	function owner(stack: FlowerElement[]): string {
		const color = flowerOwner(stack);
		if (color === 'red') return 'Red';
		if (color === 'blue') return 'Blue';
		return stack.length > 0 ? 'Pollen only' : 'Empty';
	}
</script>

<ul class="flowers">
	{#each FLOWER_NAMES as name (name)}
		{@const stack = flowers[name]}
		{@const bottom = bottomNectar(stack)}
		<li>
			<div class="stack" role="img" aria-label="{LABELS[name]}. {describe(stack)}.">
				{#each { length: height } as _, index (index)}
					<span class={['ball', stack[index] ?? 'none']}></span>
				{/each}
			</div>
			<span class="name">{LABELS[name]}</span>
			<span class={['owner', flowerOwner(stack)]}>
				{#if bottom && bottom !== flowerOwner(stack)}
					{owner(stack)} on top, {bottom} at the bottom
				{:else}
					{owner(stack)}
				{/if}
			</span>
		</li>
	{/each}
</ul>

<style>
	.flowers {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 16px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		justify-items: center;
		gap: 4px;
		text-align: center;
		min-width: 0;
	}

	.stack {
		display: flex;
		flex-direction: column-reverse;
		gap: 3px;
		padding: 4px 10px 6px;
		border-bottom: 2px solid var(--line-2);
	}

	.ball {
		width: 14px;
		height: 14px;
		border-radius: 50%;
	}

	.ball.red {
		background: var(--red);
	}

	.ball.blue {
		background: var(--blue);
	}

	.ball.pollen {
		background: var(--surface);
		box-shadow: inset 0 0 0 1.5px var(--text-3);
	}

	.ball.none {
		box-shadow: inset 0 0 0 1px var(--line);
	}

	.name {
		font-size: 13px;
		color: var(--text-2);
		line-height: 1.3;
	}

	.owner {
		font-size: 13px;
		color: var(--text-3);
	}

	.owner.red {
		color: var(--red);
	}

	.owner.blue {
		color: var(--blue);
	}

	@media (max-width: 480px) {
		.flowers {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
