<svelte:options namespace="svg" />

<script lang="ts">
	import dark from '#lib/assets/fields/biobuzz-dark.webp';
	import light from '#lib/assets/fields/biobuzz-light.webp';

	const SIDE = 440;
	const START = 20;
</script>

<g class="field">
	<image class="map light" href={light} x={START} y={START} width={SIDE} height={SIDE} />
	<image class="map dark" href={dark} x={START} y={START} width={SIDE} height={SIDE} />
</g>

<style>
	.map {
		pointer-events: none;
	}

	.dark {
		display: none;
	}

	@media screen and (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .light {
			display: none;
		}

		:global(:root:not([data-theme='light'])) .dark {
			display: inline;
		}
	}

	@media screen {
		:global(:root[data-theme='dark']) .light {
			display: none;
		}

		:global(:root[data-theme='dark']) .dark {
			display: inline;
		}
	}
</style>
