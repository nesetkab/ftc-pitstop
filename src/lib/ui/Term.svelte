<script lang="ts">
	import { explain } from '#lib/format/glossary.ts';

	interface Props {
		label: string;
		term?: string;
	}

	let { label, term }: Props = $props();

	const title = $derived(explain(term ?? label));
</script>

{#if title}<abbr {title}>{label}</abbr>{:else}{label}{/if}

<style>
	abbr {
		text-decoration: none;
		cursor: help;
	}
</style>
