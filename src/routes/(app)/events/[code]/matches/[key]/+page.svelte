<script lang="ts">
	import { page } from '$app/state';
	import { getEventView } from '#lib/components/event/context.ts';
	import MatchView from '#lib/components/event/MatchView.svelte';
	import { titleOf } from '#lib/components/event/matches.ts';
	import { withBreakdowns } from '#lib/game/breakdowns.ts';
	import { breadcrumbs, matchDescription, siteTitle } from '#lib/seo.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Seo from '#lib/ui/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const bundle = $derived(withBreakdowns(data.bundle, data.breakdowns));
	const match = $derived(bundle.matches.find((entry) => entry.key === data.key) ?? null);
	const event = $derived(bundle.event);
	const title = $derived(match ? titleOf(match) : 'Match');
	const path = $derived(`/events/${event.code}/matches/${data.key}`);
	const crumbs = $derived(
		breadcrumbs(page.url.origin, [
			{ name: 'PitStop', path: '/' },
			{ name: 'Events', path: '/events' },
			{ name: event.name, path: `/events/${event.code}` },
			{ name: title, path }
		])
	);
</script>

<Seo
	title={siteTitle(`${title} at ${event.name}`)}
	description={match ? matchDescription(match, title, event) : undefined}
	{path}
	data={[crumbs]}
	noindex={!match}
/>

{#if match}
	<MatchView
		{bundle}
		{match}
		analysis={data.analysis}
		oprShifts={data.oprShifts}
		followed={view.followed}
	/>
{:else}
	<EmptyState title="This match isn't in the schedule anymore." />
{/if}
