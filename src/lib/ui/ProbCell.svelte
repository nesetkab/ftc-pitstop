<script lang="ts">
	import { pct } from '#lib/format/pct.ts';
	import { heatBackground } from './heat.ts';

	interface Props {
		p: number | null | undefined;
		shade?: boolean;
	}

	let { p, shade = true }: Props = $props();
</script>

<td style:background={shade ? heatBackground(p) : undefined}>{pct(p)}</td>
