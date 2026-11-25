<script lang="ts">
	interface Props {
		dir?: 'up' | 'down';
		class?: string;
	}

	let { dir = 'up', class: className }: Props = $props();
</script>

<svg class={['arrow', dir, className]} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
	<path d="M6 10.5V1.75M2.25 5.5 6 1.75 9.75 5.5" />
</svg>

<style>
	.arrow {
		display: inline-block;
		flex: none;
		width: 0.85em;
		height: 0.85em;
		vertical-align: -0.08em;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.35;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.down {
		transform: rotate(180deg);
	}
</style>
