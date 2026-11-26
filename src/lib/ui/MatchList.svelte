<script lang="ts" module>
	export type MatchListItem = {
		label: string;
		status?: string;
		detail?: string;
		value?: string;
		state?: 'done' | 'next' | 'upcoming';
		href?: string;
		onpick?: () => void;
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
			{#if item.href}
				<a class="label" href={item.href} onclick={item.onpick}>{item.label}</a>
			{:else if item.onpick}
				<button type="button" class="label" onclick={item.onpick}>{item.label}</button>
			{:else}
				<b class="label">{item.label}</b>
			{/if}
			<span class="status">{item.status ?? ''}</span>
			<span class="detail">{item.detail ?? ''}</span>
			<span class="value">{item.value ?? ''}</span>
		</li>
	{/each}
</ol>

<style>
	.ml {
		display: grid;
		grid-template-columns: minmax(2.6em, auto) minmax(4.4em, auto) minmax(0, 1fr) auto;
		column-gap: 0.6em;
		margin: 0;
		font-size: 0.85em;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: subgrid;
		align-items: baseline;
		padding: 0.42em 0;
		border-bottom: 1px solid var(--line);
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

	button.label {
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: 600;
		text-align: left;
		text-decoration: underline;
		cursor: pointer;
	}

	li:has(button.label) {
		position: relative;
	}

	/* The whole row opens the match, not just its label. */
	button.label::after {
		content: '';
		position: absolute;
		inset: 0;
	}

	@media (pointer: coarse) {
		li {
			position: relative;
			padding-block: 0.72em;
		}

		a.label::after {
			content: '';
			position: absolute;
			inset: 0;
		}
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
