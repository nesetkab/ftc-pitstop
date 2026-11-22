<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getEventView } from '#lib/components/event/context.ts';
	import { isMultiDay } from '#lib/components/event/dates.ts';
	import ScheduleView from '#lib/components/event/ScheduleView.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const view = getEventView();
	const bundle = $derived(data.bundle);

	let team = $state<number | null>(null);

	$effect(() => {
		const value = Number(page.url.searchParams.get('team'));
		team = Number.isInteger(value) && value > 0 ? value : null;
	});

	function choose(next: number | null) {
		const url = new URL(page.url.href);
		if (next === null) url.searchParams.delete('team');
		else url.searchParams.set('team', String(next));
		goto(url, { replace: true, reset: false });
	}
</script>

{#if bundle.matches.length === 0}
	<EmptyState title="The match schedule hasn't been posted yet.">
		This page fills in on its own once it is.
	</EmptyState>
{:else}
	<ScheduleView
		code={bundle.event.code}
		matches={bundle.matches}
		teams={bundle.teams}
		timezone={bundle.event.timezone}
		forecasts={data.analysis?.forecasts ?? null}
		timing={data.analysis?.timing ?? null}
		followed={view.followed}
		byDay={isMultiDay(bundle.event)}
		{team}
		onteam={choose}
	/>
{/if}
