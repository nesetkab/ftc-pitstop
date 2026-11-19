<script lang="ts">
	interface Props {
		number: number;
		alliance?: 'red' | 'blue';
		me?: boolean;
		href?: string;
	}

	let { number, alliance, me = false, href }: Props = $props();
</script>

<svelte:element this={href ? 'a' : 'span'} class={['team-chip', alliance, { me }]} {href}>
	{number}
</svelte:element>

<style>
	.team-chip {
		display: inline-block;
		padding: 2px 7px;
		border-radius: var(--radius-chip);
		background: var(--surface);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-decoration: none;
		white-space: nowrap;
	}

	.red {
		background: var(--red-wash);
	}

	.blue {
		background: var(--blue-wash);
	}

	.me {
		box-shadow: inset 0 0 0 2px var(--accent);
	}

	a.team-chip:hover {
		text-decoration: underline;
	}
</style>
