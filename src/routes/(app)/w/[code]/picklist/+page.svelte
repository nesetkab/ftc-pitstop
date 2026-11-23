<script lang="ts">
	import PickList from '#lib/components/tools/PickList.svelte';
	import ShareLink from '#lib/components/tools/ShareLink.svelte';
	import { SelectionFeed } from '#lib/workspace/feed.svelte.ts';
	import { sharePayload } from '#lib/workspace/share.ts';
	import { getWorkspace } from '#lib/workspace/workspace.svelte.ts';

	const workspace = getWorkspace();
	const list = $derived(workspace.docs.picklist);
	const feed = new SelectionFeed(() => list.event, {
		teams: () => list.entries.map((entry) => entry.team)
	});
</script>

<svelte:head>
	<title>Pick list, team tools - PitStop</title>
</svelte:head>

<PickList
	{list}
	showTitle={false}
	update={(change) => workspace.update('picklist', change)}
	auto={feed.labels}
	stats={feed.stats}
	lookupName={(team) => feed.name(team)}
>
	{#snippet share()}
		<ShareLink
			build={() =>
				sharePayload('picklist', list, {
					from: workspace.code,
					team: workspace.meta?.teamNumber ?? null
				})}
		/>
	{/snippet}
</PickList>
