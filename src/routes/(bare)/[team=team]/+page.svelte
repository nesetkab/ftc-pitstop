<script lang="ts">
	import { untrack } from 'svelte';
	import { PitAlerts } from '#lib/components/pit/notify.svelte.ts';
	import PhoneScreen from '#lib/components/pit/PhoneScreen.svelte';
	import { PitSession } from '#lib/components/pit/session.svelte.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { pitAnalysis } from './pit.remote.ts';
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
					loadAnalysis: (request) => pitAnalysis(request)
				})
			: null
	);

	const alerts = new PitAlerts();

	$effect(() => {
		alerts.load();
	});

	$effect(() => session?.start());

	$effect(() => {
		if (!session || !session.signature) return;
		untrack(() => void session.refreshAnalysis());
	});

	$effect(() => {
		const view = session?.view;
		const timeZone = session?.bundle?.event.timezone;
		if (!view || !timeZone) return;
		untrack(() => alerts.observe(view, timeZone));
	});
</script>

<svelte:head>
	<title>{data.team}{data.teamName ? ` ${data.teamName}` : ''} | PitStop</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if data.state === 'no-events'}
	<main class="message">
		<EmptyState title="{data.team} has no events this season." />
	</main>
{:else if data.state === 'unavailable'}
	<main class="message">
		<EmptyState title={data.message}>This page tries again on its own.</EmptyState>
	</main>
{:else if session?.view && session.bundle}
	<PhoneScreen
		view={session.view}
		event={session.bundle.event}
		matches={session.bundle.matches}
		now={session.clock}
		call={session.call}
		connection={session.connection}
		updated={session.bundle.fetchedAt}
		source={session.bundle.source}
		stale={session.stale}
		alerts={alerts.settings}
		permission={alerts.permission}
		onalert={(key, on) => alerts.set(key, on)}
		replaySpeed={session.replay?.speed ?? null}
	/>
{:else}
	<main class="message">
		<EmptyState title="Waiting for event data">
			FTC Events is not responding. This page tries again on its own.
		</EmptyState>
	</main>
{/if}

<style>
	.message {
		display: grid;
		align-content: start;
		max-width: 560px;
		margin: 0 auto;
		padding: 24px 16px;
	}
</style>
