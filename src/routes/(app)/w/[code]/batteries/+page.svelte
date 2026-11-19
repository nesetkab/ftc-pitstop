<script lang="ts">
	import BatteryLog from '#lib/components/tools/BatteryLog.svelte';
	import ShareLink from '#lib/components/tools/ShareLink.svelte';
	import { sharePayload } from '#lib/workspace/share.ts';
	import { getWorkspace } from '#lib/workspace/workspace.svelte.ts';

	const workspace = getWorkspace();
	const batteries = $derived(workspace.docs.batteries);
</script>

<svelte:head>
	<title>Batteries, team tools</title>
</svelte:head>

<BatteryLog
	{batteries}
	match={workspace.docs.checklist.match}
	update={(change) => workspace.update('batteries', change)}
>
	{#snippet share()}
		<ShareLink
			build={() =>
				sharePayload('batteries', batteries, {
					from: workspace.code,
					team: workspace.meta?.teamNumber ?? null
				})}
		/>
	{/snippet}
</BatteryLog>
