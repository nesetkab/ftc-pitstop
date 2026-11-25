<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { keepOffline } from '#lib/pwa/register.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	$effect(() => void keepOffline(page.url.href));

	$effect(() => {
		if (data.state !== 'unavailable') return;
		const timer = setInterval(() => void invalidateAll(), 60_000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<link rel="manifest" href="/{data.team}/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="PitStop" />
</svelte:head>

{@render children()}
