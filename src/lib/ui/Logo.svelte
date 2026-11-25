<script lang="ts">
	interface Props {
		height?: string;
		label?: string;
	}

	let { height = '18px', label = 'PitStop' }: Props = $props();
</script>

<span class="logo" style:height role="img" aria-label={label}></span>

<style>
	.logo {
		display: block;
		flex: none;
		aspect-ratio: 256 / 51;
		background: currentColor;
		-webkit-mask: url('/logo.svg') center / contain no-repeat;
		mask: url('/logo.svg') center / contain no-repeat;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	@media (forced-colors: active) {
		.logo {
			background: CanvasText;
			forced-color-adjust: none;
		}
	}
</style>
