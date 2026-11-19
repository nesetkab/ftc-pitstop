<script lang="ts">
	import { fixed } from '#lib/format/number.ts';

	interface Props {
		low: number;
		high: number;
		value: number;
		max: number;
	}

	let { low, high, value, max }: Props = $props();

	const at = (point: number) => Math.min(100, Math.max(0, (point / max) * 100));
</script>

<span
	class="range"
	role="img"
	aria-label="{fixed(low)} to {fixed(high)}"
	title="{fixed(low)} to {fixed(high)}"
>
	<i style:left="{at(low)}%" style:width="{Math.max(0, at(high) - at(low))}%"></i>
	<u style:left="calc({at(value)}% - 1px)"></u>
</span>

<style>
	.range {
		position: relative;
		display: block;
		width: 120px;
		height: 12px;
		margin-left: auto;
	}

	i {
		position: absolute;
		top: 5px;
		height: 2px;
		background: var(--line-2);
	}

	u {
		position: absolute;
		top: 1px;
		width: 2px;
		height: 10px;
		background: var(--text);
	}
</style>
