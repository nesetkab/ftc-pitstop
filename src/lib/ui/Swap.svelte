<script lang="ts">
	import { rise } from './motion.ts';

	interface Props {
		value: string | number;
		duration?: number;
	}

	let { value, duration = 260 }: Props = $props();
</script>

<span class="swap"
	>{#key value}<span
			in:rise={{ y: 5, duration, delay: duration * 0.25 }}
			out:rise={{ y: -5, duration: duration * 0.5 }}>{value}</span
		>{/key}</span
>

<style>
	.swap {
		display: inline-grid;
	}

	.swap > span {
		grid-area: 1 / 1;
	}
</style>
