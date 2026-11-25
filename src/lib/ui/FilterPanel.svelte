<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		summary?: string[];
		search?: Snippet;
		children: Snippet;
	}

	let { summary = [], search, children }: Props = $props();

	const id = $props.id();
	let open = $state(false);
	let toggle = $state<HTMLButtonElement>();
	let panel = $state<HTMLDivElement>();

	function onkeydown(event: KeyboardEvent) {
		if (!open || event.key !== 'Escape') return;
		const target = event.target as Node;
		if (target !== toggle && !panel?.contains(target)) return;
		open = false;
		toggle?.focus();
	}
</script>

<svelte:window {onkeydown} />

<div class={['bar', { searching: search !== undefined }]}>
	{@render search?.()}
	<button
		bind:this={toggle}
		type="button"
		class="toggle"
		aria-expanded={open}
		aria-controls={id}
		onclick={() => (open = !open)}
	>
		Filters
		<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
			<path d="M3 4.5 6 7.5 9 4.5" />
		</svg>
	</button>
	{#if summary.length > 0}
		<span class="summary">{summary.join(' · ')}</span>
	{/if}
</div>
<div class={['panel', { open }]} {id} bind:this={panel}>
	{@render children()}
</div>

<style>
	.bar,
	.panel {
		display: contents;
	}

	.toggle,
	.summary {
		display: none;
	}

	.toggle {
		flex: none;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		padding: 0 12px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--text);
		font: 500 14px/1 var(--font);
	}

	.toggle:hover {
		border-color: var(--text-3);
	}

	.toggle[aria-expanded='true'] {
		background: var(--surface);
	}

	svg {
		fill: none;
		stroke: var(--text-3);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	svg {
		transition: transform 160ms ease-out;
	}

	.toggle[aria-expanded='true'] svg {
		transform: rotate(180deg);
	}

	.summary {
		flex: 1 1 0;
		min-width: 0;
		overflow: hidden;
		font-size: 14px;
		color: var(--text-2);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.searching .summary {
		flex-basis: 100%;
		font-size: 13px;
	}

	@media (max-width: 640px) and (scripting: enabled) {
		.bar {
			display: flex;
			flex: 1 1 100%;
			flex-wrap: wrap;
			align-items: center;
			gap: 8px 12px;
			min-width: 0;
		}

		.bar > :global(:first-child:not(.toggle)) {
			flex: 1 1 0;
			min-width: 0;
		}

		.toggle {
			display: inline-flex;
		}

		.summary {
			display: block;
		}

		.toggle[aria-expanded='true'] ~ .summary {
			display: none;
		}

		.panel:not(.open) {
			display: none;
		}

		.panel.open > :global(*) {
			animation: ps-pop 160ms ease-out;
		}
	}
</style>
