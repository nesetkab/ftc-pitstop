<script lang="ts">
	import { onMount } from 'svelte';
	import Checklist from '#lib/components/tools/Checklist.svelte';
	import ShareLink from '#lib/components/tools/ShareLink.svelte';
	import { browserStorage, type StorageLike } from '#lib/workspace/device-store.ts';
	import { readInitials, saveInitials } from '#lib/workspace/recents.ts';
	import { sharePayload } from '#lib/workspace/share.ts';
	import { getWorkspace } from '#lib/workspace/workspace.svelte.ts';

	const workspace = getWorkspace();
	const checklist = $derived(workspace.docs.checklist);

	let initials = $state('');
	let storage: StorageLike | null = null;

	onMount(() => {
		storage = browserStorage().storage;
		initials = readInitials(storage);
	});

	function rememberInitials(value: string) {
		initials = storage ? saveInitials(storage, value) : value;
	}
</script>

<svelte:head>
	<title>Checklist, team tools</title>
</svelte:head>

<Checklist
	{checklist}
	{initials}
	oninitials={rememberInitials}
	update={(change) => workspace.update('checklist', change)}
>
	{#snippet share()}
		<ShareLink
			build={() =>
				sharePayload('checklist', checklist, {
					from: workspace.code,
					team: workspace.meta?.teamNumber ?? null
				})}
		/>
	{/snippet}
</Checklist>
