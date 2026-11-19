<script lang="ts" module>
	export type KeyValueItem = { key: string; value: string | number };
</script>

<script lang="ts">
	interface Props {
		items: KeyValueItem[];
	}

	let { items }: Props = $props();
</script>

<dl class="kv">
	{#each items as item (item.key)}
		<dt>{item.key}</dt>
		<dd>{item.value}</dd>
	{/each}
</dl>

<style>
	.kv {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 8px 16px;
		margin: 0;
		font-size: 14px;
	}

	dt {
		color: var(--text-2);
	}

	dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
