<script lang="ts">
	import { rise } from './motion.ts';

	interface Props {
		value: string | number;
		duration?: number;
	}

	let { value, duration = 260 }: Props = $props();
</script>

<span class="swap"
	>{#key value}<span in:rise={{ y: 5, duration }} out:rise={{ y: -5, duration: duration * 0.7 }}
			>{value}</span
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
