<script lang="ts">
	import '@fontsource-variable/hanken-grotesk';
	import font from '@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2?url';
	import '#lib/styles/tokens.css';
	import '#lib/styles/table.css';
	import '#lib/styles/print.css';
	import { onMount } from 'svelte';
	import { version } from '$app/env';
	import { scheduleRecovery } from '#lib/pwa/recover.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => scheduleRecovery(version));
</script>

<svelte:head>
	<link rel="preload" href={font} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

{@render children()}
