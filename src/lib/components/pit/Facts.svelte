<script lang="ts">
	import type { Fact } from './copy.ts';

	interface Props {
		facts: Fact[];
	}

	let { facts }: Props = $props();
</script>

<dl class="facts">
	{#each facts as fact (fact.label)}
		<div>
			<dt>{fact.label}</dt>
			<dd>
				{fact.value}
				{#if fact.detail}<small>{fact.detail}</small>{/if}
			</dd>
		</div>
	{/each}
</dl>

<style>
	.facts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.9em 0.8em;
		margin: 0;
	}

	.facts:has(> div:nth-child(4):last-child),
	.facts:has(> div:nth-child(2):last-child) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.facts div {
		display: grid;
		gap: 0.1em;
		min-width: 0;
	}

	dt {
		font-size: 0.74em;
		color: var(--text-2);
	}

	dd {
		margin: 0;
		font-size: 1.5em;
		font-weight: 600;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	small {
		font-size: 0.55em;
		font-weight: 500;
		color: var(--text-2);
	}
</style>
