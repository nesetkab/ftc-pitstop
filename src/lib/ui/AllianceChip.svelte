<script lang="ts">
	interface Props {
		alliance: 'red' | 'blue';
		label?: string;
	}

	let { alliance, label }: Props = $props();
</script>

<span class={['chip', alliance]}>{label ?? (alliance === 'red' ? 'Red' : 'Blue')}</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		padding: 3px 8px;
		border-radius: var(--radius-chip);
		font-size: 13px;
		font-weight: 500;
		line-height: 1.45;
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
