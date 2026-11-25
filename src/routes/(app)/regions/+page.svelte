<script lang="ts">
	import EventSections from '#lib/components/event/EventSections.svelte';
	import { REGION_BUCKETS } from '#lib/components/event/event-list.ts';
	import RegionList from '#lib/components/region/RegionList.svelte';
	import { SEASON_NAME, siteTitle } from '#lib/seo.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import StaleNotice from '#lib/ui/StaleNotice.svelte';
	import type { SortState } from '#lib/ui/data-table.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let sort = $state<SortState | null>(null);

	const groups = $derived(
		REGION_BUCKETS.map(({ bucket, label }) => ({
			bucket,
			label,
			regions: listed
				.filter((region) => region.bucket === bucket)
				.sort((a, b) => a.name.localeCompare(b.name))
		})).filter((group) => group.regions.length > 0)
	);
	const listed = $derived(data.regions.filter((region) => region.events > 0));
</script>

<Seo
	title={siteTitle(`FTC regions, ${SEASON_NAME}`)}
	description="Every FTC region in the {SEASON_NAME} season with its team count, events played and still to come, and its top team by aOPR."
	path="/regions"
/>

<EventSections />

<PageHeader title="Regions">
	{#snippet status()}
		{#if data.updated}
			<StaleNotice updated={data.updated} staleAfter={86400} prefix="Ratings updated" />
		{/if}
	{/snippet}
</PageHeader>

{#if listed.length === 0}
	<EmptyState title="The event list is still loading. Try again soon." />
{:else}
	{#each groups as group (group.bucket)}
		<section aria-labelledby="{group.bucket}-title">
			<h2 class="sec-title" id="{group.bucket}-title">{group.label}</h2>
			<RegionList regions={group.regions} caption="Regions in {group.label}" bind:sort />
		</section>
	{/each}
{/if}

<style>
	section {
		display: grid;
		gap: 10px;
	}
</style>
