<script lang="ts" module>
	export type Bar = { label: string; value: number | null };
</script>

<script lang="ts">
	import { fixed } from '#lib/format/number.ts';

	interface Props {
		items: Bar[];
		max?: number;
		format?: (value: number | null) => string;
	}

	let { items, max, format = (value: number | null) => fixed(value) }: Props = $props();

	const top = $derived(max ?? Math.max(0, ...items.map((item) => item.value ?? 0)));

	function share(value: number | null) {
		if (value == null || !(top > 0)) return 0;
		return Math.min(1, Math.max(0, value / top));
	}
</script>

<ul class="bars">
	{#each items as item (item.label)}
		<li>
			<span class="label">{item.label}</span>
			<span class="track" aria-hidden="true">
				<span class="fill" style:width="{(share(item.value) * 100).toFixed(1)}%"></span>
			</span>
			<span class="value">{format(item.value)}</span>
		</li>
	{/each}
</ul>

<style>
	.bars {
		display: grid;
		grid-template-columns: minmax(70px, max-content) minmax(0, 1fr) minmax(44px, max-content);
		gap: 8px 10px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 13px;
	}

	li {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		align-items: center;
	}

	.track {
		position: relative;
		display: block;
		height: 10px;
		border-radius: 2px;
		background: var(--surface);
	}

	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 2px;
		background: var(--text-2);
	}

	.value {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
