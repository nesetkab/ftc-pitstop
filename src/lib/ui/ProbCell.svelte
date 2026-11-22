<script lang="ts">
	import { pct } from '#lib/format/pct.ts';
	import { heatBackground } from './heat.ts';

	interface Props {
		p: number | null | undefined;
		shade?: boolean;
		class?: string;
	}

	let { p, shade = true, class: className }: Props = $props();
</script>

<td class={className} style:background={shade ? heatBackground(p) : undefined}>{pct(p)}</td>
