<script lang="ts">
	import type { Component } from 'svelte';
	import AppBar from '#lib/ui/AppBar.svelte';
	import ThemeSwitch from '#lib/ui/ThemeSwitch.svelte';
	import { searchDialog, searchShortcut } from '#lib/ui/search.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	let SearchDialog = $state<Component<{ open?: boolean }>>();
	let loading: Promise<void> | undefined;

	function loadSearch() {
		loading ??= import('#lib/ui/SearchDialog.svelte').then((module) => {
			SearchDialog = module.default;
		});
		return loading;
	}

	function onkeydown(event: KeyboardEvent) {
		if (SearchDialog || !searchShortcut(event)) return;
		event.preventDefault();
		searchDialog.open = true;
	}

	$effect(() => {
		if (searchDialog.open) loadSearch();
	});

	$effect(() => {
		if ('requestIdleCallback' in window) {
			const handle = requestIdleCallback(loadSearch, { timeout: 4000 });
			return () => cancelIdleCallback(handle);
		}
		const timer = setTimeout(loadSearch, 2000);
		return () => clearTimeout(timer);
	});
</script>

<svelte:window {onkeydown} />

<div class="shell">
	<a class="skip" href="#main">Skip to content</a>
	<AppBar onsearch={() => (searchDialog.open = true)} />
	<main id="main" tabindex="-1">
		{@render children()}
	</main>
	<footer>
		<div class="credits">
			<p>
				Data from <a href="https://ftc-events.firstinspires.org">FIRST FTC Events</a>,
				<a href="https://ftcscout.org">FTCScout</a> and <a href="https://ftc.nexus">Nexus</a>.
			</p>
			<p>Not affiliated with or endorsed by FIRST.</p>
		</div>
		<nav aria-label="Footer">
			<a href="/w">Team workspace</a>
			<a href="/advancement">Advancement</a>
			<a href="/about">About the numbers</a>
			<a href="/accuracy">Prediction accuracy</a>
			<a href="https://github.com/nesetkab/ftc-pitstop">GitHub</a>
		</nav>
		<div class="footer-theme">
			<ThemeSwitch />
		</div>
	</footer>
</div>

{#if SearchDialog}
	<SearchDialog bind:open={searchDialog.open} />
{/if}

<style>
	.shell {
		display: grid;
		grid-template-rows: auto 1fr auto;
		min-height: 100dvh;
	}

	.skip {
		position: absolute;
		top: 8px;
		left: 8px;
		z-index: 10;
		padding: 8px 12px;
		border-radius: var(--radius-control);
		background: var(--text);
		color: var(--bg);
		font-size: 14px;
		text-decoration: none;
	}

	.skip:not(:focus) {
		clip-path: inset(50%);
		width: 1px;
		height: 1px;
		overflow: hidden;
		white-space: nowrap;
	}

	main {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--space-stack);
		width: 100%;
		max-width: var(--page-max);
		margin-inline: auto;
		padding: 28px var(--gutter) 48px;
	}

	main:focus {
		outline: none;
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px 24px;
		width: calc(100% - 2 * var(--gutter));
		max-width: calc(var(--page-max) - 2 * var(--gutter));
		margin: var(--space-stack) auto 0;
		padding: 16px 0 40px;
		border-top: 1px solid var(--line);
		font-size: 13px;
		color: var(--text-3);
	}

	.credits {
		display: grid;
		gap: 2px;
	}

	footer nav {
		display: flex;
		flex-wrap: wrap;
		align-content: start;
		gap: 4px 16px;
	}

	footer nav a {
		display: inline-flex;
		align-items: center;
		min-height: 24px;
	}

	footer a:hover {
		color: var(--text-2);
	}

	.footer-theme {
		display: none;
		flex-basis: 100%;
	}

	@media (max-width: 600px) {
		.footer-theme {
			display: block;
		}
	}

	@media (pointer: coarse) {
		footer a {
			display: inline-block;
			margin-block: -10px;
			padding-block: 10px;
		}
	}
</style>
