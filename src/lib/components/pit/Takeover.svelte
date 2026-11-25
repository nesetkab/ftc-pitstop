<script lang="ts">
	import type { AllianceColor } from '#lib/types.ts';
	import { fade } from '#lib/ui/motion.ts';

	interface Props {
		headline: string;
		label: string;
		alliance: AllianceColor;
		ondismiss: () => void;
	}

	let { headline, label, alliance, ondismiss }: Props = $props();

	let button: HTMLButtonElement | undefined = $state();

	$effect(() => {
		button?.focus();
	});
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && ondismiss()} />

<button
	bind:this={button}
	type="button"
	class="takeover"
	onclick={ondismiss}
	in:fade={{ duration: 320 }}
	out:fade={{ duration: 200 }}
>
	<b>{headline}</b>
	<span>{label}, {alliance} alliance</span>
</button>

<style>
	.takeover {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: grid;
		align-content: center;
		justify-items: start;
		gap: 0.6em;
		padding: 0 3em;
		border: 0;
		background: var(--accent);
		color: var(--on-accent);
		font: inherit;
		text-align: left;
	}

	b {
		font-size: min(9em, 15vw);
		line-height: 0.9;
		font-weight: 700;
		letter-spacing: -0.04em;
	}

	span {
		font-size: 2.2em;
		font-weight: 500;
	}

	.takeover:focus-visible {
		outline: 0.2em solid var(--on-accent);
		outline-offset: -0.6em;
	}
</style>
