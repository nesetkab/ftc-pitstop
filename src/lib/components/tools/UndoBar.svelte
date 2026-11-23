<script lang="ts">
	import { isTextEntry } from '#lib/ui/search.svelte.ts';
	import type { UndoOffer } from '#lib/workspace/undo.svelte.ts';

	interface Props {
		offer: UndoOffer;
	}

	let { offer }: Props = $props();

	let bar = $state<HTMLElement>();

	function onkeydown(event: KeyboardEvent) {
		if (!offer.label || event.defaultPrevented || isTextEntry(event.target)) return;
		const command = event.metaKey || event.ctrlKey;
		if (!command || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'z') return;
		event.preventDefault();
		offer.undo();
	}

	function onfocusout(event: FocusEvent) {
		if (!bar?.contains(event.relatedTarget as Node | null)) offer.release();
	}
</script>

<svelte:window {onkeydown} />

<div class="dock" aria-live="polite">
	{#if offer.label}
		<div
			class="bar"
			role="group"
			aria-label="Undo the last change"
			bind:this={bar}
			onpointerenter={() => offer.hold()}
			onpointerleave={() => {
				if (!bar?.contains(document.activeElement)) offer.release();
			}}
			onfocusin={() => offer.hold()}
			{onfocusout}
		>
			<span>{offer.label}</span>
			<button
				type="button"
				class="undo"
				aria-keyshortcuts="Control+Z Meta+Z"
				onclick={() => offer.undo()}>Undo</button
			>
			<button type="button" class="close" aria-label="Dismiss" onclick={() => offer.dismiss()}>
				<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
					<path d="M2 2l8 8M10 2l-8 8" />
				</svg>
			</button>
		</div>
	{/if}
</div>

<style>
	.dock {
		position: fixed;
		inset: auto 16px max(16px, env(safe-area-inset-bottom)) 16px;
		z-index: 20;
		display: flex;
		justify-content: center;
		pointer-events: none;
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 4px;
		max-width: 100%;
		padding: 6px 6px 6px 16px;
		border-radius: var(--radius-control);
		background: var(--text);
		color: var(--bg);
		font-size: 14px;
		pointer-events: auto;
	}

	.bar span {
		margin-right: 8px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	button {
		display: inline-grid;
		place-items: center;
		min-height: 36px;
		padding: 0 12px;
		border: 0;
		border-radius: var(--radius-chip);
		background: transparent;
		color: inherit;
		font: 600 14px/1 var(--font);
	}

	button:hover {
		background: color-mix(in srgb, var(--bg) 16%, transparent);
	}

	button:focus-visible {
		outline: 2px solid var(--bg);
		outline-offset: -2px;
	}

	.undo {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.close {
		padding: 0 10px;
	}

	.close path {
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
	}

	@media (pointer: coarse) {
		button {
			min-height: 44px;
		}
	}
</style>
