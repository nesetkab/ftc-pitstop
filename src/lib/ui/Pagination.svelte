<script lang="ts">
	import { goto } from '$app/navigation';
	import { integer } from '#lib/format/index.ts';
	import Button from '#lib/ui/Button.svelte';

	interface Props {
		page: number;
		pages: number;
		href: (page: number) => string;
	}

	let { page, pages, href }: Props = $props();

	const id = $props.id();
	let typed = $derived(String(page));
	let asked = $derived(page);

	function jump() {
		const n = Number.parseInt(typed, 10);
		const target = Number.isFinite(n) ? Math.min(Math.max(n, 1), pages) : page;
		typed = String(target);
		if (target === asked) return;
		asked = target;
		goto(href(target));
	}

	function enter(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		jump();
	}
</script>

{#if pages > 1}
	<nav class="pager" aria-label="Pages">
		{#if page > 1}
			<Button variant="secondary" icon="prev" href={href(page - 1)} rel="prev">Previous</Button>
		{:else}
			<Button variant="secondary" icon="prev" disabled>Previous</Button>
		{/if}
		<span class="n">
			<label for="{id}-page">Page</label>
			<input
				id="{id}-page"
				class="num"
				type="text"
				inputmode="numeric"
				pattern="[0-9]*"
				enterkeyhint="go"
				autocomplete="off"
				aria-describedby="{id}-of"
				style:width="{Math.max(String(pages).length, 2) + 1}ch"
				bind:value={typed}
				onkeydown={enter}
				onchange={jump}
			/>
			<span id="{id}-of">of {integer(pages)}</span>
		</span>
		{#if page < pages}
			<Button variant="secondary" iconEnd="next" href={href(page + 1)} rel="next">Next</Button>
		{:else}
			<Button variant="secondary" iconEnd="next" disabled>Next</Button>
		{/if}
	</nav>
{/if}

<style>
	.pager {
		display: flex;
		align-items: center;
		gap: 14px;
		font-size: 14px;
		color: var(--text-2);
	}

	.n {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
	}

	.num {
		box-sizing: content-box;
		min-height: calc(var(--control-h) - 2px);
		padding: 0 6px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		font: 500 14px/1 var(--font);
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.num:hover {
		border-color: var(--text-3);
	}

	.num:focus-visible {
		border-color: var(--text);
		outline: 2px solid var(--text);
		outline-offset: 1px;
	}

	@media (pointer: coarse) {
		.pager :global(.btn) {
			min-height: 44px;
		}

		.num {
			min-height: 42px;
			font-size: 16px;
		}
	}

	@media (max-width: 600px) {
		.pager {
			gap: 10px;
		}

		.num {
			font-size: 16px;
		}
	}
</style>
