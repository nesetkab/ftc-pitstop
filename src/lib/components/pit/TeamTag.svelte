<script lang="ts">
	import type { AllianceColor } from '#lib/types.ts';

	interface Props {
		number: number;
		alliance?: AllianceColor | null;
		me?: boolean;
	}

	let { number, alliance = null, me = false }: Props = $props();
</script>

<span class={['tag', alliance, { me }]}>{number}</span>

<style>
	.tag {
		display: inline-block;
		padding: 0.15em 0.45em;
		border-radius: 0.2em;
		background: var(--surface);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.red {
		background: var(--red-wash);
	}

	.blue {
		background: var(--blue-wash);
	}

	.me {
		background: var(--accent);
		color: var(--on-accent);
	}
</style>
