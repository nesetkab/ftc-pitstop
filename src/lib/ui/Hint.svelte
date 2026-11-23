<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { dismissHint, readHints, type HintId } from './hints.ts';

	interface Props {
		id: HintId;
		children: Snippet;
	}

	let { id, children }: Props = $props();

	let visible = $state(false);

	onMount(() => {
		visible = !readHints().includes(id);
	});

	function hide() {
		dismissHint(id);
		visible = false;
	}
</script>

{#if visible}
	<p class="hint">
		<span>{@render children()}</span>
		<button type="button" onclick={hide}>Hide</button>
	</p>
{/if}

<style>
	.hint {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 14px;
		padding: 9px 0 9px 12px;
		border-left: 2px solid var(--line-2);
		font-size: 14px;
		color: var(--text-2);
	}

	.hint span {
		flex: 1 1 18em;
	}

	button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--text-3);
		font: inherit;
		font-size: 13px;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	button:hover {
		color: var(--text);
	}

	@media (pointer: coarse) {
		button {
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
