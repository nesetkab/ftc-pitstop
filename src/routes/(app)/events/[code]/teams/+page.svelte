<script lang="ts">
	import { getEventView } from '#lib/components/event/context.ts';
	import TeamsTable from '#lib/components/event/TeamsTable.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const bundle = $derived(data.bundle);
	const note = $derived(
		data.season
			? `${bundle.teams.length} teams. Season OPR and world rank cover every BIOBUZZ match played so far.`
			: `${bundle.teams.length} teams.`
	);
	const ratings = $derived(
		data.analysis && data.analysis.ratings.length > 0 ? data.analysis.ratings : null
	);
</script>

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
		eventCode={bundle.event.code}
	/>
	<p class="note">
		{note} Open a team for its scouting report, or
		<a href="/events/{bundle.event.code}/scouting">print reports for every team</a>.
	</p>
{/if}
