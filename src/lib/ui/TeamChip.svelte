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
		min-width: calc(var(--team-digits) + 12px);
		padding: 2px 6px;
		border-radius: var(--radius-chip);
		background: var(--surface);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-align: center;
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

	@media (pointer: coarse) {
		a.team-chip {
			position: relative;
		}

		a.team-chip::after {
			content: '';
			position: absolute;
			inset: -8px 0;
		}
	}
</style>
