<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

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
