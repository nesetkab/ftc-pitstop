<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ROW_FIT, rowCapacity } from './view.ts';

	interface Props {
		count: number;
		children: Snippet<[number]>;
	}

	let { count, children }: Props = $props();

	let box: HTMLDivElement | undefined = $state();
	let height = $state(0);
	let em = $state(0);
	let row = $state(ROW_FIT.row);

	const shown = $derived(Math.min(count, rowCapacity(height, em, row) ?? count));

	$effect(() => {
		if (!box || typeof ResizeObserver === 'undefined') return;
		const target = box;
		const observer = new ResizeObserver(() => {
			const style = getComputedStyle(target);
			height = target.clientHeight;
			em = parseFloat(style.fontSize);
			row = parseFloat(style.getPropertyValue('--row')) || ROW_FIT.row;
		});
		observer.observe(target);
		return () => observer.disconnect();
	});
</script>

<div
	class="fit"
	bind:this={box}
	style:--rows={shown + 1}
	style:--min={ROW_FIT.min}
	style:--max={ROW_FIT.max}
	style:--row-base={ROW_FIT.row}
>
	<div class="rows">{@render children(shown)}</div>
</div>

<style>
	.fit {
		--row: var(--row-base);
		min-height: 0;
		overflow: hidden;
		container-type: size;
	}

	.rows {
		font-size: clamp(
			calc(var(--min) * 1em),
			calc(100cqh / (var(--rows) * var(--row) + 0.25)),
			calc(var(--max) * 1em)
		);
	}

	.rows :global(:is(th, td, li)) {
		height: calc(var(--row) * 1em);
		padding-block: 0;
		line-height: 1.25;
		vertical-align: middle;
	}
</style>
