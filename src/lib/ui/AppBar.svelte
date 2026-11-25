<script lang="ts">
	import { page } from '$app/state';
	import Icon from './Icon.svelte';
	import Logo from './Logo.svelte';
	import ThemeSwitch from './ThemeSwitch.svelte';

	interface Props {
		onsearch: () => void;
	}

	let { onsearch }: Props = $props();

	const links = [
		{ href: '/events', label: 'Events', also: ['/advancement'] },
		{ href: '/teams', label: 'Teams' },
		{ href: '/leaderboards', label: 'Leaderboards' },
		{ href: '/records', label: 'Records' },
		{ href: '/compare', label: 'Compare' }
	];

	function current(href: string, also: string[] = []) {
		const path = page.url.pathname;
		if (path === href) return 'page';
		const within = (base: string) => path === base || path.startsWith(`${base}/`);
		return within(href) || also.some(within) ? 'true' : undefined;
	}
</script>

<header class="appbar">
	<div class="inner">
		<a class="home" href="/"><Logo height="15px" /></a>
		<nav aria-label="Main">
			{#each links as link (link.href)}
				<a href={link.href} aria-current={current(link.href, link.also)}>{link.label}</a>
			{/each}
		</nav>
		<button
			type="button"
			class="search"
			aria-haspopup="dialog"
			aria-keyshortcuts="/ Control+K Meta+K"
			onclick={onsearch}
		>
			<Icon name="search" size={14} />
			<span>Search teams and events</span>
			<kbd aria-hidden="true">/</kbd>
		</button>
		<div class="theme">
			<ThemeSwitch />
		</div>
	</div>
</header>

<style>
	.appbar {
		border-bottom: 1px solid var(--line);
	}

	.inner {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr) auto auto;
		grid-template-areas: 'home nav . search theme';
		align-items: center;
		column-gap: 22px;
		max-width: var(--page-max);
		margin-inline: auto;
		padding: 12px var(--gutter);
	}

	.home {
		grid-area: home;
		justify-self: start;
		display: block;
		margin-block: -8px;
		padding-block: 12px;
		color: var(--text);
	}

	nav {
		grid-area: nav;
		display: flex;
		gap: 18px;
		font-size: 14px;
		color: var(--text-2);
	}

	nav a {
		margin-block: -10px;
		padding-block: 10px;
		text-decoration: none;
		white-space: nowrap;
	}

	nav a:hover {
		color: var(--text);
	}

	nav a[aria-current] {
		color: var(--text);
		font-weight: 500;
	}

	.search {
		grid-area: search;
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 230px;
		padding: 6px 10px;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--text-3);
		font-size: 13px;
		line-height: 1.4;
		text-align: left;
	}

	.search span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.search:hover {
		border-color: var(--text-3);
		color: var(--text-2);
	}

	.search kbd {
		margin-left: auto;
	}

	.theme {
		grid-area: theme;
		justify-self: end;
	}

	@media (max-width: 900px) {
		.inner {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				'home nav'
				'search theme';
			row-gap: 10px;
			column-gap: 12px;
		}

		.search {
			min-width: 0;
		}
	}

	@media (max-width: 600px) {
		.inner {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas:
				'home'
				'nav'
				'search';
		}

		nav {
			flex-wrap: wrap;
			justify-content: space-between;
			gap: 0 12px;
		}

		.theme {
			display: none;
		}
	}

	@media (max-width: 400px) {
		nav {
			gap: 0 8px;
		}
	}

	@media (hover: none) {
		.search kbd {
			display: none;
		}
	}

	@media (pointer: coarse) {
		.home {
			margin-block: -9px;
			padding-block: 13px;
		}

		.search {
			min-height: 40px;
		}
	}
</style>
