<script lang="ts">
	import WorkspaceShell from '#lib/components/tools/WorkspaceShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

{#key data.code}
	<WorkspaceShell code={data.code} shared={data.shared}>
		{@render children()}
	</WorkspaceShell>
{/key}
