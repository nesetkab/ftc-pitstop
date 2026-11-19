<script lang="ts">
	import type { AllianceColor } from '#lib/types.ts';
	import { colorName } from './copy.ts';

	interface Props {
		alliance: AllianceColor;
		label?: string;
	}

	let { alliance, label }: Props = $props();
</script>

<span class={['chip', alliance]}>{label ?? `${colorName(alliance)} alliance`}</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		padding: 0.25em 0.6em;
		border-radius: 0.2em;
		font-weight: 500;
		white-space: nowrap;
	}

	.red {
		background: var(--red-wash);
		color: var(--red);
	}

	.blue {
		background: var(--blue-wash);
		color: var(--blue);
	}
</style>
