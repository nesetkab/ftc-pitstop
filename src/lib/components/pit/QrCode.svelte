<script lang="ts">
	import { encodeQr, qrPath } from './qr.ts';

	interface Props {
		text: string;
		label: string;
	}

	let { text, label }: Props = $props();

	const code = $derived(encodeQr(text, 'M'));
	const size = $derived(code.size + 8);
</script>

<svg
	class="qr"
	viewBox="0 0 {size} {size}"
	role="img"
	aria-label={label}
	shape-rendering="crispEdges"
>
	<rect width={size} height={size} />
	<path d={qrPath(code)} />
</svg>

<style>
	.qr {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 0.3em;
	}

	rect {
		fill: #ffffff;
	}

	path {
		fill: #121212;
	}
</style>
