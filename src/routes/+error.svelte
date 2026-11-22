<script lang="ts">
	import { page } from '$app/state';
	import Logo from '#lib/ui/Logo.svelte';

	const missing = $derived(page.status === 404);
	const title = $derived(missing ? 'Page not found' : 'Something went wrong');
	const message = $derived(page.error?.message ?? '');
	const detail = $derived.by(() => {
		if (missing && message && message !== 'Not Found') return `${message}.`;
		if (missing) return 'There is no page at this address.';
		return 'This page could not be loaded. Try again in a moment.';
	});
</script>

<svelte:head>
	<title>{title} - PitStop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="screen pit">
	<header>
		<a href="/"><Logo height="1em" /></a>
	</header>
	<main>
		<p class="status">Error {page.status}</p>
		<h1>{title}</h1>
		<p class="detail">{detail}</p>
		<a class="home" href="/">Go to the PitStop home page</a>
	</main>
</div>

<style>
	.screen {
		position: fixed;
		inset: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		overflow-y: auto;
		background: var(--bg);
		color: var(--text);
		font-size: clamp(16px, 1.6vw, 28px);
		line-height: 1.3;
	}

	header {
		display: flex;
		align-items: center;
		padding: 0.9em var(--gutter);
		border-bottom: 1px solid var(--line);
	}

	header a {
		display: inline-flex;
	}

	main {
		display: grid;
		align-content: center;
		justify-items: start;
		gap: 0.6em;
		width: 100%;
		max-width: 40em;
		padding: 2em var(--gutter);
	}

	.status {
		color: var(--text-2);
		font-size: 0.9em;
		font-variant-numeric: tabular-nums;
	}

	h1 {
		font-size: 2.6em;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.detail {
		color: var(--text-2);
		font-size: 1.1em;
	}

	.home {
		display: inline-flex;
		align-items: center;
		min-height: 2.6em;
		margin-top: 0.8em;
		padding: 0 1em;
		border: 1px solid var(--line-2);
		border-radius: var(--radius-control);
		font-weight: 600;
		text-decoration: none;
	}

	.home:hover {
		border-color: var(--text-2);
	}
</style>
