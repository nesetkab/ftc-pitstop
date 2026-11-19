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

	function pathOf(href: string) {
		const path = href.split(/[?#]/)[0];
		return path.length > 1 ? path.replace(/\/+$/, '') : path;
	}

	const active = $derived(pathOf(current ?? page.url.pathname));
</script>

<nav class="tabs" aria-label={label}>
	{#each tabs as tab (tab.href)}
		<a href={tab.href} aria-current={pathOf(tab.href) === active ? 'page' : undefined}>
			{tab.label}
		</a>
	{/each}
</nav>

<style>
	.tabs {
		display: flex;
		gap: 24px;
		margin: -2px -2px 0;
		padding: 2px 2px 0;
		border-bottom: 1px solid var(--line);
		font-size: 14px;
		color: var(--text-2);
		overflow-x: auto;
	}

	a {
		padding-bottom: 10px;
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
		outline-offset: 0;
		border-radius: 2px;
	}
</style>
