<script lang="ts">
	import { untrack } from 'svelte';
	import { page, updated } from '$app/state';
	import { pitAnalysis } from '#lib/components/pit/analysis.remote.ts';
	import { reloadDue, reloadOntoNewBuild, watchDeploys } from '#lib/components/pit/deploy.ts';
	import { analysisLoader, PitSession } from '#lib/components/pit/session.svelte.ts';
	import TvMessage from '#lib/components/pit/TvMessage.svelte';
	import TvScreen from '#lib/components/pit/TvScreen.svelte';
	import { keepAwake } from '#lib/components/pit/wake.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const session = $derived(
		data.state === 'ready'
			? new PitSession({
					team: data.team,
					code: data.code,
					bundle: data.bundle,
					analysis: data.analysis,
					queue: data.queue,
					nexus: data.nexus,
					replay: data.replay,
					loadAnalysis: analysisLoader((request) => pitAnalysis(request))
				})
			: null
	);

	const phoneUrl = $derived(`${page.url.host}/${data.team}`);

	$effect(() => session?.start());

	$effect(() => keepAwake());

	$effect(() => watchDeploys(() => updated.check()));

	$effect(() => {
		if (!session) return;
		if (reloadDue({ updated: updated.current, replay: session.replay, call: session.call })) {
			void reloadOntoNewBuild();
		}
	});

	$effect(() => {
		if (!session || !session.signature) return;
		untrack(() => void session.refreshAnalysis());
	});
</script>

<svelte:head>
	<title>{data.team} pit display - PitStop</title>
	<meta name="theme-color" content="#121212" />
	<meta name="robots" content="noindex" />
</svelte:head>

{#if data.state === 'no-events'}
	<TvMessage title="{data.team} has no events this season." />
{:else if data.state === 'unavailable'}
	<TvMessage title={data.message} detail="This screen tries again on its own." />
{:else if session?.view && session.bundle}
	<TvScreen
		view={session.view}
		event={session.bundle.event}
		now={session.clock}
		call={session.call}
		takeover={session.takeover}
		connection={session.connection}
		updated={session.bundle.fetchedAt}
		source={session.bundle.source}
		stale={session.stale}
		{phoneUrl}
		replaySpeed={session.replay?.speed ?? null}
		ondismiss={() => session.dismiss()}
	/>
{:else}
	<TvMessage
		title="Waiting for event data"
		detail="FTC Events is not responding. This screen tries again on its own."
	/>
{/if}
