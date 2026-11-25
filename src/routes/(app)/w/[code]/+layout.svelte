<script lang="ts">
	import { page } from '$app/state';
	import WorkspaceShell from '#lib/components/tools/WorkspaceShell.svelte';
	import { keepOffline } from '#lib/pwa/register.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	$effect(() => void keepOffline(page.url.href));
</script>

{#key data.code}
	<WorkspaceShell code={data.code} shared={data.shared}>
		{@render children()}
	</WorkspaceShell>
{/key}
