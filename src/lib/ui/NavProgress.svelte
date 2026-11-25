<script lang="ts">
	import { untrack } from 'svelte';
	import { navigating } from '$app/state';

	interface Props {
		delay?: number;
	}

	let { delay = 150 }: Props = $props();

	let phase = $state<'idle' | 'running' | 'done'>('idle');
	const active = $derived(navigating.to !== null);

	$effect(() => {
		if (!active) return;
		const timer = setTimeout(() => (phase = 'running'), delay);
		return () => {
			clearTimeout(timer);
			untrack(() => {
				if (phase === 'running') phase = 'done';
			});
		};
	});

	$effect(() => {
		if (phase !== 'done') return;
		const timer = setTimeout(() => (phase = 'idle'), 300);
		return () => clearTimeout(timer);
	});
</script>

{#if phase !== 'idle'}
	<div class="progress {phase}" aria-hidden="true"></div>
{/if}

<style>
	.progress {
		position: fixed;
		inset: 0 0 auto;
		z-index: 20;
		height: 2px;
		background: var(--accent);
		transform-origin: left;
		pointer-events: none;
	}

	.running {
		animation: grow 8s cubic-bezier(0.1, 0.7, 0.2, 1) forwards;
	}

	.done {
		transform: scaleX(1);
		opacity: 0;
		transition: opacity 0.3s 0.1s;
	}

	@keyframes grow {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(0.9);
		}
	}
</style>
