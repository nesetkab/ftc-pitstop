<script lang="ts">
	import AppBar from '#lib/ui/AppBar.svelte';
	import SearchDialog from '#lib/ui/SearchDialog.svelte';
	import ThemeSwitch from '#lib/ui/ThemeSwitch.svelte';
	import { searchDialog } from '#lib/ui/search.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<div class="shell">
	<a class="skip" href="#main">Skip to content</a>
	<AppBar onsearch={() => (searchDialog.open = true)} />
	<main id="main" tabindex="-1">
		{@render children()}
	</main>
	<footer>
		<p>
			Data from <a href="https://ftc-events.firstinspires.org">FTC Events</a> and
			<a href="https://ftcscout.org">FTCScout</a>.
		</p>
		<nav aria-label="Footer">
			<a href="/accuracy">Prediction accuracy</a>
		</nav>
		<div class="footer-theme">
			<ThemeSwitch />
		</div>
	</footer>
</div>

<SearchDialog bind:open={searchDialog.open} />

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
		gap: 22px;
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
		margin: 24px auto 0;
		padding: 16px 0 40px;
		border-top: 1px solid var(--line);
		font-size: 13px;
		color: var(--text-3);
	}

	footer nav {
		display: flex;
		gap: 16px;
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
</style>
