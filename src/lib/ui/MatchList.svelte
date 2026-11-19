<script lang="ts" module>
	export type MatchListItem = {
		label: string;
		status?: string;
		detail?: string;
		value?: string;
		state?: 'done' | 'next' | 'upcoming';
		href?: string;
	};
</script>

<script lang="ts">
	interface Props {
		items: MatchListItem[];
	}

	let { items }: Props = $props();
</script>

<ol class="ml">
	{#each items as item (item.label)}
		<li class={item.state}>
			<svelte:element this={item.href ? 'a' : 'b'} class="label" href={item.href}>
				{item.label}
			</svelte:element>
			<span class="status">{item.status ?? ''}</span>
			<span class="detail">{item.detail ?? ''}</span>
			<span class="value">{item.value ?? ''}</span>
		</li>
	{/each}
</ol>

<style>
	.ml {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: 2.6em 4.4em minmax(0, 1fr) auto;
		gap: 0.6em;
		align-items: baseline;
		padding: 0.42em 0;
		border-bottom: 1px solid var(--line);
		font-size: 0.85em;
		font-variant-numeric: tabular-nums;
	}

	.label {
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	a.label:hover {
		text-decoration: underline;
	}

	.status,
	.detail {
		color: var(--text-2);
		white-space: nowrap;
	}

	.detail {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.value {
		text-align: right;
		white-space: nowrap;
	}

	.next {
		margin: 0 -0.5em;
		padding-inline: 0.5em;
		background: var(--accent-wash);
	}

	.done .status,
	.done .detail,
	.done .value {
		color: var(--text-3);
	}
</style>
