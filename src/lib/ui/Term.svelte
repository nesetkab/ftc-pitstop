<script lang="ts">
	import { explain } from '#lib/format/glossary.ts';
	import { termTip } from './term-tip.ts';

	interface Props {
		label: string;
		term?: string;
		nested?: boolean;
	}

	let { label, term, nested = false }: Props = $props();

	const text = $derived(explain(term ?? label));
</script>

{#if text && nested}
	<span class="term" {@attach termTip(text, true)}>{label}</span>
{:else if text}
	<button type="button" class="term" {@attach termTip(text)}>{label}</button>
{:else}{label}{/if}

<style>
	.term {
		cursor: help;
	}

	button {
		display: inline;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
		text-align: inherit;
		text-transform: inherit;
		white-space: inherit;
	}

	:global(.term-tip) {
		position: fixed;
		inset: auto;
		z-index: 30;
		max-width: min(280px, calc(100vw - 16px));
		margin: 0;
		padding: 7px 10px;
		overflow: visible;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.12);
		font: 400 13px/1.4 var(--font);
		text-align: left;
		white-space: normal;
		pointer-events: auto;
	}

	:global(.term-tip[hidden]) {
		display: none;
	}
</style>
