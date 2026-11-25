<script lang="ts">
	import { untrack } from 'svelte';
	import { updated } from '$app/state';
	import { pitAnalysis } from '#lib/components/pit/analysis.remote.ts';
	import { reloadDue, reloadOntoNewBuild, watchDeploys } from '#lib/components/pit/deploy.ts';
	import { PitAlerts } from '#lib/components/pit/notify.svelte.ts';
	import PhoneScreen from '#lib/components/pit/PhoneScreen.svelte';
	import { analysisLoader, PitSession } from '#lib/components/pit/session.svelte.ts';
	import {
		parseRankMemory,
		postedQuals,
		RANK_KEY,
		rememberRank,
		type RankMemory
	} from '#lib/components/pit/standing.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
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
					loadAnalysis: analysisLoader((request) => pitAnalysis(request)),
					pollHidden: () => alerts.enabled
				})
			: null
	);

	const alerts = new PitAlerts();

	let rankMemory = $state<RankMemory | null>(null);

	const rankKey = $derived(
		session && !session.replay ? `${RANK_KEY}:${session.code}:${session.team}` : null
	);

	const title = $derived.by(() => {
		const base = `${data.team}${data.teamName ? ` ${data.teamName}` : ''} - PitStop`;
		const call = session?.call;
		return call ? `Queue now: ${call.label} - ${base}` : base;
	});

	$effect(() => {
		const key = rankKey;
		untrack(() => {
			try {
				rankMemory = key ? parseRankMemory(localStorage.getItem(key)) : null;
			} catch {
				rankMemory = null;
			}
		});
	});

	$effect(() => {
		const view = session?.view;
		if (!view) return;
		const posted = postedQuals(view);
		const rank = view.ranking?.rank ?? null;
		untrack(() => {
			const next = rememberRank(rankMemory, posted, rank);
			if (next === rankMemory) return;
			rankMemory = next;
			if (!rankKey || !next) return;
			try {
				localStorage.setItem(rankKey, JSON.stringify(next));
			} catch {
				return;
			}
		});
	});

	$effect(() => {
		alerts.load();
	});

	$effect(() => session?.start());

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

	$effect(() => {
		const view = session?.view;
		const timeZone = session?.bundle?.event.timezone;
		if (!view || !timeZone) return;
		untrack(() => alerts.observe(view, timeZone, session.clock));
	});
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if data.state === 'no-events'}
	<main class="message">
		<EmptyState title="{data.team} has no events this season." />
	</main>
{:else if data.state === 'unavailable'}
	<main class="message">
		<EmptyState title={data.message} />
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
		analysis={session.analysis}
		{rankMemory}
		vibrate={alerts.vibrate}
		canVibrate={alerts.canVibrate}
		onvibrate={(on) => alerts.setVibrate(on)}
		ontest={() => alerts.test()}
	/>
{:else}
	<main class="message">
		<EmptyState title="Waiting for event data">
			FTC Events is not responding.
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
