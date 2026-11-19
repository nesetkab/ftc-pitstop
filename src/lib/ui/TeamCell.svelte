<script lang="ts">
	interface Props {
		number: number;
		name?: string | null;
		href?: string;
	}

	let { number, name, href }: Props = $props();
</script>

<svelte:element this={href ? 'a' : 'span'} class="team-cell" {href}>
	<b>{number}</b>
	{#if name}
		<span class="name">{name}</span>
	{/if}
</svelte:element>

<style>
	.team-cell {
		text-decoration: none;
	}

	a.team-cell:hover {
		text-decoration: underline;
	}

	b {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.name {
		margin-left: 4px;
		color: var(--text-2);
	}

	:global(tr.me) .name {
		color: var(--text);
	}

	:global(tr.dim) .name {
		color: var(--text-3);
	}
</style>
