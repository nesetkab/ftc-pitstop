<script lang="ts" module>
	export type Tab = { href: string; label: string };
</script>

<script lang="ts">
	import { page } from '$app/state';

	interface Props {
		tabs: Tab[];
		current?: string;
		label?: string;
	}

	let { tabs, current, label = 'Sections' }: Props = $props();

	let nav = $state<HTMLElement>();
	let more = $state({ start: false, end: false });

	function pathOf(href: string) {
		const path = href.split(/[?#]/)[0];
		return path.length > 1 ? path.replace(/\/+$/, '') : path;
	}

	function measure() {
		if (!nav) return;
		const max = nav.scrollWidth - nav.clientWidth;
		more = { start: nav.scrollLeft > 1, end: nav.scrollLeft < max - 1 };
	}

	function nudge(direction: 1 | -1) {
		nav?.scrollBy({ left: direction * nav.clientWidth * 0.6, behavior: 'smooth' });
	}

	const active = $derived(pathOf(current ?? page.url.pathname));

	$effect(() => {
		if (!nav || !active) return;
		const tab = nav.querySelector<HTMLElement>('[aria-current="page"]');
		if (tab && nav.scrollWidth > nav.clientWidth) {
			nav.scrollLeft = tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2;
		}
		measure();
	});
</script>

<svelte:window onresize={measure} />

{#snippet chevron(direction: 1 | -1)}
	<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
		<path d={direction === 1 ? 'M5.5 3.5 9 7l-3.5 3.5' : 'M8.5 3.5 5 7l3.5 3.5'} />
	</svg>
{/snippet}

<div class={['tab-row', { 'more-start': more.start, 'more-end': more.end }]}>
	<nav class="tabs" aria-label={label} bind:this={nav} onscroll={measure}>
		{#each tabs as tab (tab.href)}
			<a href={tab.href} aria-current={pathOf(tab.href) === active ? 'page' : undefined}>
				{tab.label}
			</a>
		{/each}
	</nav>
	{#if more.start}
		<button
			type="button"
			class="nudge start"
			tabindex="-1"
			aria-label="Scroll {label.toLowerCase()} back"
			onclick={() => nudge(-1)}>{@render chevron(-1)}</button
		>
	{/if}
	{#if more.end}
		<button
			type="button"
			class="nudge end"
			tabindex="-1"
			aria-label="Scroll {label.toLowerCase()} forward"
			onclick={() => nudge(1)}>{@render chevron(1)}</button
		>
	{/if}
</div>

<style>
	.tab-row {
		--fade: 64px;
		position: relative;
		border-bottom: 1px solid var(--line);
	}

	.tabs {
		display: flex;
		gap: 24px;
		margin: -2px -2px 0;
		padding: 2px 2px 0;
		font-size: 14px;
		color: var(--text-2);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tabs::-webkit-scrollbar {
		display: none;
	}

	.more-end .tabs {
		mask-image: linear-gradient(to right, #000 calc(100% - var(--fade)), transparent);
	}

	.more-start .tabs {
		mask-image: linear-gradient(to left, #000 calc(100% - var(--fade)), transparent);
	}

	.more-start.more-end .tabs {
		mask-image: linear-gradient(
			to right,
			transparent,
			#000 var(--fade),
			#000 calc(100% - var(--fade)),
			transparent
		);
	}

	a {
		padding: 9px 0 10px;
		text-decoration: none;
		white-space: nowrap;
	}

	a:hover {
		color: var(--text);
	}

	a[aria-current='page'] {
		color: var(--text);
		font-weight: 500;
		box-shadow: inset 0 -2px 0 var(--text);
	}

	a:focus-visible {
		outline-offset: -2px;
		border-radius: 2px;
	}

	.nudge {
		position: absolute;
		top: 0;
		bottom: 1px;
		display: grid;
		place-items: center;
		width: 32px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--text-2);
		cursor: pointer;
	}

	.nudge:hover {
		color: var(--text);
	}

	.nudge.start {
		left: -6px;
		justify-items: start;
	}

	.nudge.end {
		right: -6px;
		justify-items: end;
	}

	svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	@media (max-width: 600px) {
		.tabs {
			gap: 20px;
		}
	}
</style>
