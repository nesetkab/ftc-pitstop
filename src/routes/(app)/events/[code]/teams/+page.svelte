<script lang="ts">
	import { getEventView } from '#lib/components/event/context.ts';
	import TeamsTable from '#lib/components/event/TeamsTable.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const bundle = $derived(data.bundle);
	const ratings = $derived(
		data.analysis && data.analysis.ratings.length > 0 ? data.analysis.ratings : null
	);
</script>

<svelte:head>
	<title>Teams at {bundle.event.name}</title>
</svelte:head>

{#if bundle.teams.length === 0}
	<p class="muted">No teams have registered yet.</p>
{:else}
	<TeamsTable
		teams={bundle.teams}
		rankings={bundle.rankings}
		{ratings}
		season={data.season}
		seasonCount={data.seasonCount}
		followed={view.followed}
	/>
	<p class="note">
		{bundle.teams.length} teams.{#if data.season}
			Season OPR and world rank cover every BIOBUZZ match played so far.{/if}
	</p>
{/if}
