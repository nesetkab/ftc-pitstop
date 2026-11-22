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

<nav
	class={['tabs', { 'more-start': more.start, 'more-end': more.end }]}
	aria-label={label}
	bind:this={nav}
	onscroll={measure}
>
	{#each tabs as tab (tab.href)}
		<a href={tab.href} aria-current={pathOf(tab.href) === active ? 'page' : undefined}>
			{tab.label}
		</a>
	{/each}
</nav>

<style>
	.tabs {
		position: relative;
		display: flex;
		gap: 24px;
		margin: -2px -2px 0;
		padding: 2px 2px 0;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		color: var(--text-2);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tabs::-webkit-scrollbar {
		display: none;
	}

	.more-end {
		mask-image: linear-gradient(to right, #000 calc(100% - 40px), transparent);
	}

	.more-start {
		mask-image: linear-gradient(to left, #000 calc(100% - 40px), transparent);
	}

	.more-start.more-end {
		mask-image: linear-gradient(
			to right,
			transparent,
			#000 40px,
			#000 calc(100% - 40px),
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

	@media (max-width: 600px) {
		.tabs {
			gap: 20px;
		}
	}
</style>
