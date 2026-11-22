<script lang="ts">
	import { explain, termHref } from '#lib/format/glossary.ts';

	interface Props {
		label: string;
		term?: string;
		link?: boolean;
	}

	let { label, term, link = true }: Props = $props();

	const title = $derived(explain(term ?? label));
	const href = $derived(link ? termHref(term ?? label) : null);
</script>

{#if title && href}<a class="term" {href}><abbr {title}>{label}</abbr></a>{:else if title}<abbr
		{title}>{label}</abbr
	>{:else}{label}{/if}

<style>
	abbr {
		text-decoration: none;
		cursor: help;
	}

	.term {
		color: inherit;
		text-decoration: none;
	}

	.term abbr {
		cursor: inherit;
	}

	.term:hover {
		text-decoration: underline dotted;
		text-underline-offset: 3px;
	}
</style>
